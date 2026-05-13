"""
seat_monitor_v2.py — YOLOv8-Pose 자동 캘리브레이션 + EMA 좌석 모니터

실행:
  python seat_monitor_v2.py --calibrate  # 최초 1회: 빈 좌석에서 좌석 코너 자동 감지
  python seat_monitor_v2.py              # 이후: 실시간 모니터링 + Supabase 저장

개선 사항 (vs seat_monitor.py):
  - 좌석 경계를 수동 등록 대신 YOLOv8-Pose 모델로 자동 감지
  - 사람 bbox bottom-center 사용 → 인접 좌석 오탐 감소
  - EMA 필터 → 프레임 간 깜빡임 제거
  - 카메라 위치 변경 시 --calibrate 재실행만으로 자동 보정
"""

import argparse
import cv2
import io
import os
import threading
import time
import numpy as np
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from supabase import create_client, Client
from ultralytics import YOLO
import uvicorn

load_dotenv()

# ── 경로 설정 ─────────────────────────────────────────────────────────────
BASE        = Path(__file__).parent
POSE_MODEL  = BASE / "runs" / "pose" / "seat" / "weights" / "best.pt"
CALIB_FILE  = BASE / "calibration.npz"

# ── 환경변수 ──────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RTSP_URL     = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.17.239.85/stream1")

# ── 상수 ──────────────────────────────────────────────────────────────────
SEATS        = ["N22", "N23", "N25", "N27"]   # class 0,1,2,3 (label_seats.py 기준)
ITEM_LABELS  = {"backpack", "handbag", "laptop", "book", "cup", "bottle", "bag", "suitcase"}
LOG_INTERVAL  = 10   # 초마다 Supabase 저장
IMG_W, IMG_H  = 960, 720
EMA_ALPHA     = 0.3  # 점유 EMA 가중치
EMA_THRESH    = 0.5  # 이 값 초과 시 True로 판정

# 실시간 코너 캘리브레이션
CORNER_EMA_ALPHA   = 0.05  # 코너 EMA (낮을수록 안정적, ~20프레임에 수렴)
CORNER_CONF_THRESH = 0.7   # 포즈 감지 최소 신뢰도
CORNER_KP_THRESH   = 0.4   # 키포인트 visibility 최소값
CALIB_SAVE_INTERVAL = 30   # calibration.npz 자동 저장 주기 (초)

SEAT_COLORS = {
    "N22": (34,  197,  94),   # 초록
    "N23": (239,  68,  68),   # 빨강
    "N25": (245, 158,  11),   # 주황
    "N27": ( 59, 130, 246),   # 파랑
}

# 캘리브레이션 없을 때 사용하는 기본 폴리곤 (normalized → 픽셀)
DEFAULT_POLYGONS = {
    "N22": [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
    "N23": [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
    "N25": [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
    "N27": [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
}

# ── 공유 상태 ──────────────────────────────────────────────────────────────
_latest_frame: np.ndarray | None = None
_frame_lock   = threading.Lock()
_supabase: Client | None = None
_ema_state    = {seat: {"person": 0.0, "items": 0.0} for seat in SEATS}


# ── FastAPI 프레임 서버 (AdminCalibratePage 연동) ──────────────────────────
frame_app = FastAPI()
frame_app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

@frame_app.get("/health")
def health():
    return {"status": "ok"}

@frame_app.get("/frame")
def get_frame():
    with _frame_lock:
        if _latest_frame is None:
            raise HTTPException(status_code=503, detail="카메라 연결 대기 중")
        _, buf = cv2.imencode(".jpg", _latest_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return StreamingResponse(io.BytesIO(buf.tobytes()), media_type="image/jpeg")

def _start_frame_server():
    uvicorn.run(frame_app, host="0.0.0.0", port=8000, log_level="error")


# ── RTSP 연결 ─────────────────────────────────────────────────────────────
def find_rtsp() -> cv2.VideoCapture | None:
    print(f"RTSP 연결 시도: {RTSP_URL}")
    cap = cv2.VideoCapture(RTSP_URL)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if cap.isOpened():
        ret, _ = cap.read()
        if ret:
            print("연결 성공!\n")
            return cap
    cap.release()
    print("연결 실패.")
    return None


# ── 캘리브레이션 ──────────────────────────────────────────────────────────
def run_calibration(pose_model: YOLO, cap: cv2.VideoCapture, n_frames: int) -> bool:
    """
    YOLOv8-Pose 모델로 n_frames 동안 좌석 코너를 감지하여 평균값을 저장.
    calibration.npz: {seat_name: ndarray (4, 2) in pixel coords}
    """
    print(f"\n=== 캘리브레이션 모드 ===")
    print(f"  {n_frames}프레임 수집 중 — 좌석은 비워두세요 (사람/짐 없이)")
    print("  취소: 영상 창에서 q 키\n")

    corner_accum: dict[str, list[np.ndarray]] = {seat: [] for seat in SEATS}
    collected = 0

    while collected < n_frames:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue
        frame = cv2.resize(frame, (IMG_W, IMG_H))

        results = pose_model(frame, verbose=False)[0]
        n_dets = len(results.boxes) if results.boxes is not None else 0

        for i in range(n_dets):
            cls  = int(results.boxes.cls[i])
            conf = float(results.boxes.conf[i])
            if conf < 0.7 or cls >= len(SEATS):
                continue

            # kp_data: (4, 3) — [x_px, y_px, visibility]
            kp_data = results.keypoints.data[i].cpu().numpy()
            if kp_data[:, 2].min() < 0.3:   # 모든 키포인트 visibility 체크
                continue
            corner_accum[SEATS[cls]].append(kp_data[:, :2])  # (4, 2)

        collected += 1
        pct = int(collected / n_frames * 100)
        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
        detected = [s for s in SEATS if corner_accum[s]]
        print(f"\r  [{bar}] {pct:3d}%  감지된 좌석: {detected}", end="", flush=True)

        # 현재까지 평균 코너 미리보기
        vis = frame.copy()
        for seat in SEATS:
            if corner_accum[seat]:
                avg = np.mean(corner_accum[seat], axis=0).astype(np.int32)
                color = SEAT_COLORS[seat]
                pts = avg.reshape((-1, 1, 2))
                cv2.polylines(vis, [pts], isClosed=True, color=color, thickness=2)
                for pt in avg:
                    cv2.circle(vis, tuple(pt), 6, color, -1)
                cx, cy = avg[:, 0].mean(), avg[:, 1].mean()
                cv2.putText(vis, seat, (int(cx) - 15, int(cy)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.imshow("Calibration — q: 취소", vis)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("\n\n취소됨.")
            cv2.destroyAllWindows()
            return False

    cv2.destroyAllWindows()
    print()

    # 좌석별 평균 계산 (미감지 좌석 → 기본 폴리곤 사용)
    calibration = {}
    for seat in SEATS:
        if corner_accum[seat]:
            calibration[seat] = np.mean(corner_accum[seat], axis=0)  # (4, 2)
        else:
            print(f"  [경고] {seat} 미감지 → 기본 폴리곤 사용")
            calibration[seat] = np.array(
                [[p[0] * IMG_W, p[1] * IMG_H] for p in DEFAULT_POLYGONS[seat]],
                dtype=np.float32,
            )

    np.savez(str(CALIB_FILE), **{s: calibration[s] for s in SEATS})

    print(f"\n캘리브레이션 완료! → {CALIB_FILE}")
    for seat, corners in calibration.items():
        c = corners.astype(int)
        print(f"  {seat}: TL{c[0].tolist()} TR{c[1].tolist()} BR{c[2].tolist()} BL{c[3].tolist()}")
    return True


def load_calibration() -> dict[str, np.ndarray] | None:
    if not CALIB_FILE.exists():
        return None
    data = np.load(str(CALIB_FILE))
    calib = {seat: data[seat] for seat in SEATS if seat in data}
    if len(calib) < len(SEATS):
        print(f"  [경고] calibration.npz에 일부 좌석 누락: {set(SEATS) - set(calib)}")
    return calib


# ── EMA 필터 ─────────────────────────────────────────────────────────────
def ema_update(seat: str, has_person: bool, has_items: bool) -> tuple[bool, bool]:
    s = _ema_state[seat]
    s["person"] = EMA_ALPHA * float(has_person) + (1.0 - EMA_ALPHA) * s["person"]
    s["items"]  = EMA_ALPHA * float(has_items)  + (1.0 - EMA_ALPHA) * s["items"]
    return (s["person"] > EMA_THRESH, s["items"] > EMA_THRESH)


# ── 좌석 판별 ─────────────────────────────────────────────────────────────
def get_seat_for_point(px: float, py: float,
                       seat_polygons: dict[str, np.ndarray]) -> str | None:
    for seat_id, poly in seat_polygons.items():
        pts = poly.reshape((-1, 1, 2)).astype(np.float32)
        if cv2.pointPolygonTest(pts, (float(px), float(py)), False) >= 0:
            return seat_id
    return None


# ── 시각화 ────────────────────────────────────────────────────────────────
def draw_seats(frame: np.ndarray,
               seat_polygons: dict[str, np.ndarray],
               seat_results: dict[str, tuple[bool, bool]]) -> None:
    kp_names = ["TL", "TR", "BR", "BL"]
    for seat_id, poly in seat_polygons.items():
        has_person, has_items = seat_results.get(seat_id, (False, False))
        color = SEAT_COLORS[seat_id]
        pts   = poly.reshape((-1, 1, 2)).astype(np.int32)

        overlay = frame.copy()
        cv2.fillPoly(overlay, [pts], color)
        cv2.addWeighted(overlay, 0.35 if (has_person or has_items) else 0.1,
                        frame, 0.65 if (has_person or has_items) else 0.9, 0, frame)

        cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2)

        for i, (kx, ky) in enumerate(poly):
            cv2.circle(frame, (int(kx), int(ky)), 5, color, -1)
            cv2.circle(frame, (int(kx), int(ky)), 5, (255, 255, 255), 1)
            cv2.putText(frame, kp_names[i], (int(kx) + 5, int(ky) - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1)

        cx = int(poly[:, 0].mean())
        cy = int(poly[:, 1].mean())
        label = f"{seat_id}: {_determine_status(has_person, has_items)}"
        cv2.putText(frame, label, (cx - 40, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, label, (cx - 40, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)


# ── Supabase 함수 ─────────────────────────────────────────────────────────
def _determine_status(has_person: bool, has_items: bool) -> str:
    if has_person and has_items: return "occupied"
    if has_person:               return "person_only"
    if has_items:                return "items_only"
    return "empty"

def _get_conflict_type(reserved_by, has_person: bool, has_items: bool) -> str:
    if reserved_by:
        if has_person:  return "정상"
        if has_items:   return "유령좌석_물건"
        return "유령좌석_비어있음"
    else:
        if has_person:  return "무단점유"
        if has_items:   return "무단물건"
        return "빈좌석"

def _get_active_reservations() -> dict[str, str]:
    try:
        now = datetime.now(timezone.utc).isoformat()
        result = _supabase.table("reservations") \
            .select("seat_number, user_id") \
            .eq("is_active", True) \
            .lte("start_time", now) \
            .gte("end_time", now).execute()
        reservations = {}
        for row in result.data:
            seat_num = str(row["seat_number"])
            try:
                profile = _supabase.table("profiles") \
                    .select("student_id") \
                    .eq("id", row["user_id"]).single().execute()
                sid = profile.data.get("student_id", row["user_id"]) if profile.data else row["user_id"]
            except Exception:
                sid = row["user_id"]
            reservations[seat_num] = sid
        return reservations
    except Exception as e:
        print(f"  [예약 조회 실패] {e}")
        return {}

def send_logs(seat_results: dict[str, tuple[bool, bool]]) -> None:
    try:
        now = datetime.now(timezone.utc).isoformat()
        reservations = _get_active_reservations()
        detection_rows, conflict_rows = [], []

        for seat_id, (has_person, has_items) in seat_results.items():
            status = _determine_status(has_person, has_items)
            detection_rows.append({
                "seat_id": seat_id, "has_person": has_person,
                "has_items": has_items, "status": status, "detected_at": now,
            })
            reserved_by = reservations.get(seat_id)
            conflict_rows.append({
                "seat_id": seat_id, "reserved_by": reserved_by,
                "detected_person": has_person, "detected_items": has_items,
                "conflict_type": _get_conflict_type(reserved_by, has_person, has_items),
                "checked_at": now,
            })
            seat_status = "occupied" if has_person else ("ghost" if has_items else "available")
            _supabase.table("seats").update({
                "has_person": has_person, "has_items": has_items,
                "status": seat_status, "last_updated": now,
            }).eq("seat_number", seat_id).execute()

        _supabase.table("detection_logs").insert(detection_rows).execute()
        _supabase.table("occupancy_conflict_logs").insert(conflict_rows).execute()
        print(f"  → 저장 완료 ({len(detection_rows)}개 좌석)")
    except Exception as e:
        print(f"  → 저장 실패: {e}")


# ── 메인 ─────────────────────────────────────────────────────────────────
def main():
    global _supabase

    parser = argparse.ArgumentParser(description="좌석 모니터 v2 (YOLOv8-Pose 자동 캘리브레이션)")
    parser.add_argument("--calibrate", action="store_true",
                        help="캘리브레이션 모드: 빈 좌석 상태에서 코너 자동 감지 → calibration.npz 저장")
    parser.add_argument("--calib-frames", type=int, default=30,
                        help="캘리브레이션 프레임 수 (기본 30)")
    args = parser.parse_args()

    print("=" * 55)
    print("  좌석 모니터 v2 — YOLOv8-Pose 자동 캘리브레이션")
    print("=" * 55)

    if not POSE_MODEL.exists():
        print(f"ERROR: best.pt 없음 → 먼저 python train_pose.py 실행")
        return

    pose_model = YOLO(str(POSE_MODEL))
    det_model  = YOLO("yolov8n.pt")

    # ── 캘리브레이션 모드 ────────────────────────────────────────────────
    if args.calibrate:
        cap = find_rtsp()
        if cap is None:
            print("RTSP 연결 실패.")
            return
        success = run_calibration(pose_model, cap, n_frames=args.calib_frames)
        cap.release()
        if success:
            print("\n다음 단계: python seat_monitor_v2.py")
        return

    # ── 모니터링 모드 ────────────────────────────────────────────────────
    calib = load_calibration()
    if calib:
        corner_ema = calib
        print(f"캘리브레이션 로드: {CALIB_FILE} — 실시간 보정 계속 진행")
    else:
        print("[시작] calibration.npz 없음 — 기본 폴리곤으로 시작, 실시간 캘리브레이션 자동 진행")
        corner_ema = {
            seat: np.array([[p[0] * IMG_W, p[1] * IMG_H] for p in pts], dtype=np.float32)
            for seat, pts in DEFAULT_POLYGONS.items()
        }
    seat_polygons = {s: c.copy() for s, c in corner_ema.items()}

    _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    threading.Thread(target=_start_frame_server, daemon=True).start()
    print("HTTP 서버 시작: http://localhost:8000")

    cap = find_rtsp()
    if cap is None:
        print("RTSP 연결 실패.")
        return

    print(f"모니터링 시작 — {LOG_INTERVAL}초마다 Supabase 저장")
    print("종료: 영상 창에서 q 키")
    print("-" * 55)

    seat_results: dict[str, tuple[bool, bool]] = {seat: (False, False) for seat in SEATS}
    last_log        = time.time()
    last_calib_save = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            print("프레임 읽기 실패. 3초 후 재연결...")
            cap.release()
            time.sleep(3)
            cap = find_rtsp()
            if cap is None:
                print("재연결 실패. 종료합니다.")
                break
            continue

        frame = cv2.resize(frame, (IMG_W, IMG_H))

        with _frame_lock:
            _latest_frame = frame.copy()

        det_results = det_model(frame, verbose=False)[0]

        frame_raw: dict[str, dict[str, bool]] = {
            seat: {"person": False, "items": False} for seat in SEATS
        }

        for box in det_results.boxes:
            cls   = int(box.cls[0])
            label = det_model.names[cls]
            conf  = float(box.conf[0])
            if conf < 0.3:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            if label == "person":
                # bottom-center: 사람이 앉은 위치 추정 (중심보다 정확)
                bx = (x1 + x2) / 2
                by = float(y2)
                seat = get_seat_for_point(bx, by, seat_polygons)
                if seat:
                    frame_raw[seat]["person"] = True
            elif label in ITEM_LABELS:
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2
                seat = get_seat_for_point(cx, cy, seat_polygons)
                if seat:
                    frame_raw[seat]["items"] = True

        # EMA 업데이트 (점유 상태)
        for seat in SEATS:
            seat_results[seat] = ema_update(seat,
                frame_raw[seat]["person"], frame_raw[seat]["items"])

        # 실시간 코너 캘리브레이션 — 빈 좌석에서 pose 모델로 코너 EMA 업데이트
        pose_results = pose_model(frame, verbose=False)[0]
        n_pose = len(pose_results.boxes) if pose_results.boxes is not None else 0
        for i in range(n_pose):
            cls  = int(pose_results.boxes.cls[i])
            conf = float(pose_results.boxes.conf[i])
            if conf < CORNER_CONF_THRESH or cls >= len(SEATS):
                continue
            seat = SEATS[cls]
            has_person, has_items = seat_results[seat]
            if has_person or has_items:
                continue  # 사람/짐 있으면 코너 업데이트 안 함
            kp_data = pose_results.keypoints.data[i].cpu().numpy()
            if kp_data[:, 2].min() < CORNER_KP_THRESH:
                continue
            new_corners = kp_data[:, :2].astype(np.float32)
            corner_ema[seat] = (CORNER_EMA_ALPHA * new_corners +
                                (1.0 - CORNER_EMA_ALPHA) * corner_ema[seat])
            seat_polygons[seat] = corner_ema[seat]

        # calibration.npz 자동 저장 (30초마다)
        if time.time() - last_calib_save >= CALIB_SAVE_INTERVAL:
            last_calib_save = time.time()
            np.savez(str(CALIB_FILE), **corner_ema)
            print(f"  → 캘리브레이션 자동 저장됨")

        # Supabase 로그 전송 (10초마다, 비블로킹)
        if time.time() - last_log >= LOG_INTERVAL:
            last_log = time.time()
            ts = time.strftime("%H:%M:%S")
            print(f"\n[{ts}] 로그 전송...")
            for sid, (hp, hi) in seat_results.items():
                print(f"  {sid}: {_determine_status(hp, hi)}")
            threading.Thread(target=send_logs, args=(dict(seat_results),), daemon=True).start()

        # 시각화
        annotated = det_results.plot()
        draw_seats(annotated, seat_polygons, seat_results)
        cv2.imshow("Seat Monitor v2 (q: 종료)", annotated)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("종료됨.")


if __name__ == "__main__":
    main()

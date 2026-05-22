"""
seat_detector.py — YOLO 기반 좌석 점유 감지 시스템
설계 기준: seat_detector_summary.docx

판단 기준 (악용 방지 목적):
  - 책상에 물건 없음  → auto_return  (사람 유무 무관)
  - 책상에 물건 + 사람 → occupied
  - 책상에 물건 + 사람 없음 → reserved  (잠시 자리 비움)

노이즈 필터: 동일 상태 3초 이상 유지 시에만 DB 반영

실행:
  python seat_detector.py --calibrate   # 최초 1회: 빈 좌석에서 코너 자동 감지
  python seat_detector.py               # 이후: 실시간 모니터링
"""

import argparse
import cv2
import io
import os
import threading
import time
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Tuple, List

KST = timezone(timedelta(hours=9))
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from supabase import create_client, Client
from ultralytics import YOLO
import uvicorn

load_dotenv()

BASE       = Path(__file__).parent
CALIB_FILE = BASE / "calibration.npz"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RTSP_URL     = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.17.239.85/stream1")

SEATS        = ["N22", "N23", "N25", "N27"]
# 책상 위 물건만 감지 (의자 위 소지품은 점유로 인정하지 않음)
ITEM_LABELS  = {"laptop", "keyboard", "book", "cup", "backpack", "bag", "cell phone", "mouse", "bottle"}
LOG_INTERVAL     = 10     # 초마다 Supabase 저장
IMG_W, IMG_H     = 960, 720
CONFIRM_SEC      = 5.0    # 동일 상태 유지 시간(초) — 이 이상 유지돼야 DB 반영
AUTO_RETURN_SEC  = 10.0   # 이 시간 이상 비어있으면 예약 자동 취소

SEAT_COLORS = {
    "N23": (245, 158,  11),   # 주황 (좌측 전방)
    "N27": ( 34, 197,  94),   # 초록 (우측 전방)
    "N22": ( 59, 130, 246),   # 파랑 (좌측 후방)
    "N25": (168,  85, 247),   # 보라 (우측 후방)
}

DEFAULT_POLYGONS = {
    "N23": [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
    "N27": [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
    "N22": [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
    "N25": [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
}

_latest_frame: Optional[np.ndarray] = None
_frame_lock = threading.Lock()
_supabase: Optional[Client] = None
_last_cleanup = 0.0        # 마지막 로그 정리 시각
CLEANUP_INTERVAL = 3600.0  # 1시간마다 정리
LOG_RETENTION_HOURS = 24   # 24시간 이상 된 로그 삭제

# 확정 지연 필터 상태
_filter_state = {
    seat: {"buf": (False, False), "confirmed": (False, False), "since": 0.0}
    for seat in SEATS
}

# 자동반납 타이머 (좌석별 auto_return 시작 시각)
_auto_return_since: Dict[str, Optional[float]] = {seat: None for seat in SEATS}


# ── FastAPI 프레임 서버 ────────────────────────────────────────────────────
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
def find_rtsp() -> Optional[cv2.VideoCapture]:
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



def load_calibration() -> Optional[Dict[str, np.ndarray]]:
    if not CALIB_FILE.exists():
        return None
    data = np.load(str(CALIB_FILE))
    return {seat: data[seat] for seat in SEATS if seat in data}


# ── 좌석 판별 ─────────────────────────────────────────────────────────────
def get_seat_for_point(px: float, py: float,
                       seat_polygons: Dict[str, np.ndarray]) -> Optional[str]:
    """폴리곤 내부 → 해당 좌석, 외부 → None"""
    for seat_id, poly in seat_polygons.items():
        pts = poly.reshape(-1, 1, 2).astype(np.float32)
        if cv2.pointPolygonTest(pts, (float(px), float(py)), False) >= 0:
            return seat_id
    return None


def get_seat_for_bbox(x1: int, y1: int, x2: int, y2: int,
                      seat_polygons: Dict[str, np.ndarray],
                      min_ratio: float = 0.2) -> Optional[str]:
    """bbox와 ROI 폴리곤의 겹침 비율이 가장 큰 좌석 반환
    min_ratio 이하이면 None (어느 좌석도 아님)
    """
    bbox_area = max((x2 - x1) * (y2 - y1), 1)
    bbox_mask = np.zeros((IMG_H, IMG_W), dtype=np.uint8)
    cv2.rectangle(bbox_mask, (x1, y1), (x2, y2), 255, -1)

    best_seat  = None
    best_ratio = min_ratio  # 이 값보다 커야 배정

    for seat_id, poly in seat_polygons.items():
        roi_mask = np.zeros((IMG_H, IMG_W), dtype=np.uint8)
        pts = poly.reshape(-1, 1, 2).astype(np.int32)
        cv2.fillPoly(roi_mask, [pts], 255)

        overlap   = cv2.bitwise_and(bbox_mask, roi_mask)
        ratio     = np.count_nonzero(overlap) / bbox_area

        if ratio > best_ratio:
            best_ratio = ratio
            best_seat  = seat_id

    return best_seat


# ── 확정 지연 필터 ────────────────────────────────────────────────────────
def confirm_update(seat: str, has_person: bool, has_items: bool) -> Tuple[bool, bool]:
    """동일 상태가 CONFIRM_SEC 이상 유지돼야 confirmed 상태 갱신"""
    s = _filter_state[seat]
    new_buf = (has_person, has_items)
    if new_buf != s["buf"]:
        s["buf"]  = new_buf
        s["since"] = time.time()
    elif time.time() - s["since"] >= CONFIRM_SEC:
        s["confirmed"] = new_buf
    return s["confirmed"]


# ── 좌석 상태 판단 ────────────────────────────────────────────────────────
def determine_status(has_person: bool, has_items: bool) -> str:
    if has_person:  return "occupied"    # 사람 있으면 무조건 사용중
    if has_items:   return "reserved"    # 물건만 있으면 자리맡음 (ghost)
    return "auto_return"                 # 아무것도 없으면 자동반납


# ── 시각화 ────────────────────────────────────────────────────────────────
_STATUS_EN = {"occupied": "occupied", "reserved": "reserved", "auto_return": "available"}

def draw_seats(frame: np.ndarray,
               seat_polygons: Dict[str, np.ndarray],
               seat_results: Dict[str, Tuple[bool, bool]]) -> None:
    for seat_id, poly in seat_polygons.items():
        has_person, has_items = seat_results.get(seat_id, (False, False))
        status = determine_status(has_person, has_items)
        color  = SEAT_COLORS[seat_id]
        pts    = poly.reshape(-1, 1, 2).astype(np.int32)

        overlay = frame.copy()
        cv2.fillPoly(overlay, [pts], color)
        alpha = 0.35 if status != "auto_return" else 0.1
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2)

        cx = int(poly[:, 0].mean())
        cy = int(poly[:, 1].mean())
        label = f"{seat_id}: {_STATUS_EN[status]}"
        cv2.putText(frame, label, (cx - 45, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, label, (cx - 45, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)


# ── Supabase ──────────────────────────────────────────────────────────────
def _get_active_reservations() -> Dict[str, str]:
    try:
        now = datetime.now(KST).isoformat()
        result = _supabase.table("reservations") \
            .select("seat_number, user_id") \
            .eq("is_active", True) \
            .lte("start_time", now) \
            .gte("end_time", now).execute()
        reservations = {}
        for row in result.data:
            raw = row["seat_number"]
            # DB가 integer(25)든 string("N25")든 "N25" 형식으로 통일
            if isinstance(raw, int):
                seat_num = f"N{raw}"
            else:
                seat_num = str(raw) if str(raw).startswith("N") else f"N{raw}"
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


def _cleanup_old_logs() -> None:
    global _last_cleanup
    if time.time() - _last_cleanup < CLEANUP_INTERVAL:
        return
    try:
        cutoff = (datetime.now(KST) - timedelta(hours=LOG_RETENTION_HOURS)).isoformat()
        _supabase.table("detection_logs").delete().lt("detected_at", cutoff).execute()
        _supabase.table("occupancy_conflict_logs").delete().lt("checked_at", cutoff).execute()
        _last_cleanup = time.time()
        print(f"  → 오래된 로그 정리 완료 ({LOG_RETENTION_HOURS}시간 이전 삭제)")
    except Exception as e:
        print(f"  → 로그 정리 실패: {e}")


def _to_db_seat_num(seat_id: str):
    """'N25' → 25  (DB seat_number 컬럼이 integer인 경우 대응)"""
    try:
        return int(seat_id.lstrip("N"))
    except ValueError:
        return seat_id  # 변환 실패 시 원본 그대로


def cancel_reservation(seat_id: str) -> None:
    """해당 좌석의 활성 예약을 자동 취소"""
    try:
        now = datetime.now(KST).isoformat()
        db_seat = _to_db_seat_num(seat_id)
        result = _supabase.table("reservations") \
            .update({"is_active": False, "end_time": now}) \
            .eq("seat_number", db_seat) \
            .eq("is_active", True) \
            .execute()
        if result.data:
            print(f"  → [{seat_id}] 자동반납 완료 (예약 취소)")
        else:
            print(f"  → [{seat_id}] 활성 예약 없음")
    except Exception as e:
        print(f"  → [{seat_id}] 자동반납 실패: {e}")


def send_logs(seat_results: Dict[str, Tuple[bool, bool]]) -> None:
    try:
        _cleanup_old_logs()
        now = datetime.now(KST).isoformat()
        reservations = _get_active_reservations()
        detection_rows, conflict_rows = [], []

        for seat_id, (has_person, has_items) in seat_results.items():
            status = determine_status(has_person, has_items)
            detection_rows.append({
                "seat_id": seat_id, "has_person": has_person,
                "has_items": has_items, "status": status, "detected_at": now,
            })
            reserved_by = reservations.get(seat_id)
            if reserved_by:
                ct = "정상" if status == "occupied" else (
                     "유령좌석_물건" if status == "reserved" else "유령좌석_비어있음")
            else:
                ct = "무단점유" if status == "occupied" else (
                     "무단물건" if status == "reserved" else "빈좌석")
            conflict_rows.append({
                "seat_id": seat_id, "reserved_by": reserved_by,
                "detected_person": has_person, "detected_items": has_items,
                "conflict_type": ct, "checked_at": now,
            })
            # DB seats.status: occupied→occupied, reserved→ghost, auto_return→available
            db_status = {"occupied": "occupied", "reserved": "ghost",
                         "auto_return": "available"}[status]
            _supabase.table("seats").update({
                "has_person": has_person, "has_items": has_items,
                "status": db_status, "last_updated": now,
            }).eq("seat_number", seat_id).execute()

        _supabase.table("detection_logs").insert(detection_rows).execute()
        _supabase.table("occupancy_conflict_logs").insert(conflict_rows).execute()
        print(f"  → 저장 완료 ({len(detection_rows)}개 좌석)")
    except Exception as e:
        print(f"  → 저장 실패: {e}")


# ── 메인 ─────────────────────────────────────────────────────────────────
def main():
    global _supabase

    parser = argparse.ArgumentParser(description="좌석 감지기 (책상 물건 기준 판단)")
    parser.add_argument("--calibrate", action="store_true",
                        help="캘리브레이션 안내 출력 (실제 캘리브레이션: calibrate_color.py)")
    args = parser.parse_args()

    print("=" * 55)
    print("  좌석 감지기 — 책상 물건 기준 자동반납")
    print("=" * 55)

    det_model = YOLO("yolov8s.pt")

    if args.calibrate:
        print("색깔 종이 캘리브레이션을 사용하세요:")
        print("  N22=빨강  N23=파랑  N25=노랑  N27=초록")
        print("  python calibrate_color.py")
        return

    calib = load_calibration()
    if calib:
        seat_polygons = calib
        print(f"캘리브레이션 로드: {CALIB_FILE}")
    else:
        print("[경고] calibration.npz 없음 → 기본 폴리곤 사용 (--calibrate 권장)")
        seat_polygons = {
            seat: np.array([[p[0] * IMG_W, p[1] * IMG_H] for p in pts], dtype=np.float32)
            for seat, pts in DEFAULT_POLYGONS.items()
        }

    _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    threading.Thread(target=_start_frame_server, daemon=True).start()
    print("HTTP 서버: http://localhost:8000")

    cap = find_rtsp()
    if cap is None:
        return

    print(f"모니터링 시작 — {LOG_INTERVAL}초마다 저장, {CONFIRM_SEC}초 확정 지연")
    print("판단: 책상 물건 없음→자동반납 | 물건+사람→사용중 | 물건만→자리맡음")
    print("-" * 55)

    for seat in SEATS:
        _filter_state[seat]["since"] = time.time()

    seat_results: Dict[str, Tuple[bool, bool]] = {seat: (False, False) for seat in SEATS}
    last_log   = time.time()
    last_print = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("프레임 읽기 실패. 3초 후 재연결...")
            cap.release()
            time.sleep(3)
            cap = find_rtsp()
            if cap is None:
                break
            continue

        frame = cv2.resize(frame, (IMG_W, IMG_H))
        with _frame_lock:
            _latest_frame = frame.copy()

        det_results = det_model(frame, verbose=False)[0]
        frame_raw   = {seat: {"person": False, "items": False} for seat in SEATS}
        seat_labels = {seat: {"person": False, "items": []} for seat in SEATS}

        for box in det_results.boxes:
            cls   = int(box.cls[0])
            label = det_model.names[cls]
            conf  = float(box.conf[0])
            if conf < 0.45:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            if label == "person":
                seat = get_seat_for_bbox(x1, y1, x2, y2, seat_polygons)
                if seat:
                    frame_raw[seat]["person"] = True
                    seat_labels[seat]["person"] = True

            elif label in ITEM_LABELS:
                seat = get_seat_for_bbox(x1, y1, x2, y2, seat_polygons)
                if seat:
                    frame_raw[seat]["items"] = True
                    seat_labels[seat]["items"].append(label)

        for seat in SEATS:
            seat_results[seat] = confirm_update(
                seat, frame_raw[seat]["person"], frame_raw[seat]["items"]
            )

        now = time.time()
        if now - last_print >= 1.0:
            last_print = now
            ts = time.strftime("%H:%M:%S")
            parts = []
            for s in SEATS:
                p_str = "person" if seat_labels[s]["person"] else ""
                i_str = ", ".join(seat_labels[s]["items"])
                if p_str and i_str:
                    detail = f"person+{i_str}"
                elif p_str:
                    detail = "person"
                elif i_str:
                    detail = i_str
                else:
                    detail = "empty"
                parts.append(f"{s}:{detail}")
            print(f"[{ts}]  " + "  |  ".join(parts))

        # 자동반납 타이머 체크
        for seat in SEATS:
            has_person, has_items = seat_results[seat]
            status = determine_status(has_person, has_items)
            if status == "auto_return":
                if _auto_return_since[seat] is None:
                    _auto_return_since[seat] = time.time()
                elif time.time() - _auto_return_since[seat] >= AUTO_RETURN_SEC:
                    print(f"  → [{seat}] {AUTO_RETURN_SEC}초 이상 비어있음 → 자동반납 시도")
                    threading.Thread(target=cancel_reservation, args=(seat,), daemon=True).start()
                    _auto_return_since[seat] = None  # 중복 실행 방지
            else:
                _auto_return_since[seat] = None

        if time.time() - last_log >= LOG_INTERVAL:
            last_log = time.time()
            threading.Thread(target=send_logs, args=(dict(seat_results),), daemon=True).start()

        SHOW_LABELS = ITEM_LABELS | {"person"}
        annotated = frame.copy()
        for box in det_results.boxes:
            cls   = int(box.cls[0])
            label = det_model.names[cls]
            conf  = float(box.conf[0])
            if conf < 0.3 or label not in SHOW_LABELS:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            color = (0, 255, 0) if label == "person" else (255, 200, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated, f"{label} {conf:.0%}", (x1, y1 - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)
        draw_seats(annotated, seat_polygons, seat_results)
        cv2.imshow("Seat Detector (Q: quit)", annotated)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("종료됨.")


if __name__ == "__main__":
    main()

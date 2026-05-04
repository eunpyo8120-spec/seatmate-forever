"""
seat_monitor.py — Tapo RTSP → YOLOv8 → Supabase
폴리곤 ROI 방식: 좌석별 영역을 폴리곤으로 정의, seat_roi_configs에서 로드
실행: python seat_monitor.py  |  종료: 영상 창에서 q 키
"""

import cv2
import time
import threading
import io
import numpy as np
from datetime import datetime, timezone
from dotenv import load_dotenv
import os
from supabase import create_client, Client
from ultralytics import YOLO
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

load_dotenv()

# ── 환경변수 ──────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RTSP_URL     = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.17.239.85/stream1")

ITEM_LABELS  = {"backpack", "handbag", "laptop", "book", "cup", "bottle", "bag", "suitcase"}
LOG_INTERVAL = 10   # 초마다 Supabase 저장
IMG_W, IMG_H = 960, 720
SEAT_IDS     = ["N22", "N27", "N25", "N23"]

# ── 기본 폴리곤 ROI (normalized [0,1] 좌표 → 픽셀 변환 후 사용)
# AdminCalibratePage에서 저장한 값이 없을 때 사용
# 카메라: 정면 상단에서 테이블 내려다봄
# N23=좌상단  N27=우상단  N22=좌하단  N25=우하단
DEFAULT_POLYGONS = {
    "N23": [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
    "N27": [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
    "N22": [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
    "N25": [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
}

SEAT_COLORS = {
    "N23": (239, 68, 68),    # 빨강
    "N27": (59, 130, 246),   # 파랑
    "N22": (34, 197, 94),    # 초록
    "N25": (245, 158, 11),   # 주황
}

# ── Supabase / YOLO 초기화 ────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
model = YOLO("yolov8n.pt")

# 현재 사용 중인 폴리곤 (픽셀 좌표 np.array)
SEAT_POLYGONS: dict[str, np.ndarray] = {}

# ── 공유 프레임 (FastAPI 스레드와 메인 루프가 공유) ──────────────────────
_latest_frame: np.ndarray | None = None
_frame_lock = threading.Lock()

# ── FastAPI 프레임 서버 (AdminCalibratePage 캘리브레이션용) ───────────────
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

def start_frame_server():
    uvicorn.run(frame_app, host="0.0.0.0", port=8000, log_level="error")


# ── ROI 로드 ──────────────────────────────────────────────────────────────
def load_roi_configs() -> dict[str, np.ndarray]:
    """Supabase seat_roi_configs에서 폴리곤 로드 → 픽셀 좌표 ndarray 반환"""
    try:
        result = supabase.table("seat_roi_configs") \
            .select("seat_label,points") \
            .eq("camera_id", "main").execute()

        if result.data:
            polygons = {}
            for row in result.data:
                pts = np.array([[p[0] * IMG_W, p[1] * IMG_H] for p in row["points"]], dtype=np.float32)
                polygons[row["seat_label"]] = pts
            print(f"  Supabase ROI 로드: {list(polygons.keys())}")
            return polygons
    except Exception as e:
        print(f"  ROI 로드 실패 ({e}), 기본값 사용")

    # 기본값
    polygons = {}
    for seat_id, pts in DEFAULT_POLYGONS.items():
        polygons[seat_id] = np.array([[p[0] * IMG_W, p[1] * IMG_H] for p in pts], dtype=np.float32)
    print(f"  기본 ROI 사용: {list(polygons.keys())}")
    return polygons


# ── 좌석 판별 ─────────────────────────────────────────────────────────────
def get_seat_for_point(cx: float, cy: float) -> str | None:
    """(cx, cy) 픽셀 좌표가 속하는 좌석 반환 (없으면 None)"""
    for seat_id, poly in SEAT_POLYGONS.items():
        if cv2.pointPolygonTest(poly, (cx, cy), False) >= 0:
            return seat_id
    return None


# ── 화면 그리기 ───────────────────────────────────────────────────────────
def draw_rois(frame: np.ndarray, seat_results: dict) -> None:
    """폴리곤 ROI와 좌석 상태를 프레임에 그림"""
    for seat_id, poly in SEAT_POLYGONS.items():
        has_person, has_items = seat_results.get(seat_id, (False, False))
        base_color = SEAT_COLORS.get(seat_id, (200, 200, 200))

        # 상태에 따른 채우기 투명도
        overlay = frame.copy()
        pts = poly.reshape((-1, 1, 2)).astype(np.int32)
        alpha = 0.35 if (has_person or has_items) else 0.15
        cv2.fillPoly(overlay, [pts], base_color)
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

        # 테두리
        cv2.polylines(frame, [pts], isClosed=True, color=base_color, thickness=2)

        # 라벨 (폴리곤 중심)
        cx = int(poly[:, 0].mean())
        cy = int(poly[:, 1].mean())
        status = determine_status(has_person, has_items)
        label = f"{seat_id}: {status}"
        cv2.putText(frame, label, (cx - 40, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, label, (cx - 40, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, base_color, 1, cv2.LINE_AA)


# ── 유틸 ─────────────────────────────────────────────────────────────────
def determine_status(has_person: bool, has_items: bool) -> str:
    if has_person and has_items: return "occupied"
    if has_person:               return "person_only"
    if has_items:                return "items_only"
    return "empty"


def get_conflict_type(reserved_by, has_person, has_items) -> str:
    if reserved_by:
        if has_person:  return "정상"
        if has_items:   return "유령좌석_물건"
        return "유령좌석_비어있음"
    else:
        if has_person:  return "무단점유"
        if has_items:   return "무단물건"
        return "빈좌석"


def get_active_reservations() -> dict[str, str]:
    """현재 활성 예약 조회 → {seat_id: student_id}"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        result = supabase.table("reservations") \
            .select("seat_number, user_id") \
            .eq("is_active", True) \
            .lte("start_time", now) \
            .gte("end_time", now).execute()
        reservations = {}
        for row in result.data:
            seat_num = str(row["seat_number"])
            try:
                profile = supabase.table("profiles") \
                    .select("student_id") \
                    .eq("id", row["user_id"]).single().execute()
                student_id = profile.data.get("student_id", row["user_id"]) if profile.data else row["user_id"]
            except Exception:
                student_id = row["user_id"]
            reservations[seat_num] = student_id
        return reservations
    except Exception as e:
        print(f"  [예약 조회 실패] {e}")
        return {}


def send_logs(seat_results: dict) -> None:
    """detection_logs + occupancy_conflict_logs INSERT, seats UPDATE"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        reservations = get_active_reservations()
        detection_rows, conflict_rows = [], []

        for seat_id, (has_person, has_items) in seat_results.items():
            status = determine_status(has_person, has_items)
            detection_rows.append({
                "seat_id": seat_id,
                "has_person": has_person,
                "has_items": has_items,
                "status": status,
                "detected_at": now,
            })
            reserved_by = reservations.get(seat_id)
            conflict_rows.append({
                "seat_id": seat_id,
                "reserved_by": reserved_by,
                "detected_person": has_person,
                "detected_items": has_items,
                "conflict_type": get_conflict_type(reserved_by, has_person, has_items),
                "checked_at": now,
            })
            seat_status = "occupied" if has_person else ("ghost" if has_items else "available")
            supabase.table("seats").update({
                "has_person": has_person,
                "has_items": has_items,
                "status": seat_status,
                "last_updated": now,
            }).eq("seat_number", seat_id).execute()

        supabase.table("detection_logs").insert(detection_rows).execute()
        supabase.table("occupancy_conflict_logs").insert(conflict_rows).execute()
        print(f"  → 저장 완료 ({len(detection_rows)}개 좌석)")
    except Exception as e:
        print(f"  → 저장 실패: {e}")


def find_rtsp() -> cv2.VideoCapture | None:
    candidates = [RTSP_URL]
    for url in candidates:
        print(f"연결 시도: {url}")
        cap = cv2.VideoCapture(url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print("연결 성공!\n")
                return cap
        cap.release()
    return None


# ── 메인 ─────────────────────────────────────────────────────────────────
def main():
    global SEAT_POLYGONS

    print("=== 좌석 모니터 시작 ===")

    # FastAPI 프레임 서버 백그라운드 시작
    threading.Thread(target=start_frame_server, daemon=True).start()
    print("HTTP 서버 시작: http://localhost:8000 (AdminCalibratePage 연결 가능)")

    print("ROI 설정 로드 중...")
    SEAT_POLYGONS = load_roi_configs()

    cap = find_rtsp()
    if cap is None:
        print("RTSP 연결 실패. 종료합니다.")
        return

    print(f"\n모니터링 시작 — {LOG_INTERVAL}초마다 Supabase 저장")
    print("종료: 영상 창에서 q 키 | 파란선=폴리곤 경계")
    print("-" * 50)

    seat_results: dict[str, tuple[bool, bool]] = {sid: (False, False) for sid in SEAT_POLYGONS}
    last_log = time.time()

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

        # 최신 프레임 공유 (AdminCalibratePage /frame 엔드포인트용)
        with _frame_lock:
            _latest_frame = frame.copy()

        results = model(frame, verbose=False)[0]

        frame_seats: dict[str, dict] = {sid: {"person": False, "items": False} for sid in SEAT_POLYGONS}

        for box in results.boxes:
            cls   = int(box.cls[0])
            label = model.names[cls]
            conf  = float(box.conf[0])
            if conf < 0.3:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

            seat = get_seat_for_point(cx, cy)
            if seat is None:
                continue
            if label == "person":
                frame_seats[seat]["person"] = True
            elif label in ITEM_LABELS:
                frame_seats[seat]["items"] = True

        for sid, vals in frame_seats.items():
            seat_results[sid] = (vals["person"], vals["items"])

        # 로그 전송 (threading으로 비블로킹)
        if time.time() - last_log >= LOG_INTERVAL:
            last_log = time.time()
            ts = time.strftime("%H:%M:%S")
            print(f"\n[{ts}] 로그 전송 중...")
            for sid, (hp, hi) in seat_results.items():
                print(f"  {sid}: {determine_status(hp, hi)}")
            threading.Thread(target=send_logs, args=(dict(seat_results),), daemon=True).start()

        # 시각화
        annotated = results.plot()
        draw_rois(annotated, seat_results)
        cv2.imshow("Seat Monitor (q: 종료)", annotated)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("종료됨.")


if __name__ == "__main__":
    main()

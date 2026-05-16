"""
calibrate_color.py — 색깔 종이 기반 좌석 캘리브레이션

준비물: 좌석마다 다른 색 A4 종이를 책상 중앙에 놓기
  N22 = 빨강  |  N23 = 파랑  |  N25 = 노랑  |  N27 = 초록

실행: python calibrate_color.py
키:  's' 저장  |  '+'/'-' 폴리곤 크기 조정  |  'r' 재캡처  |  'q' 취소
마우스: 꼭짓점(원) 드래그 → 개별 조정  |  폴리곤 내부 드래그 → 전체 이동
"""

import cv2
import numpy as np
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE       = Path(__file__).parent
CALIB_FILE = BASE / "calibration.npz"
RTSP_URL   = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.11.218.85:554/stream1")

IMG_W, IMG_H   = 960, 720
CAPTURE_FRAMES = 5      # 평균낼 프레임 수 (노이즈 제거)
DESK_SCALE     = 2.5    # 종이 크기 대비 책상 확장 배율 ('+'/'-'로 조정)
SCALE_STEP     = 0.1

SEATS = ["N22", "N23", "N25", "N27"]

# ── HSV 색상 범위 (A4 색지 기준, 실내 조명) ──────────────────────────────
# 조명 환경에 따라 조정 필요 시 아래 값 수정
COLOR_RANGES: dict[str, list[tuple]] = {
    "N22": [((0, 80, 50),   (10, 255, 255)),   # 빨강 (낮은 Hue)
            ((170, 80, 50), (180, 255, 255))],  # 빨강 (높은 Hue, wrap-around)
    "N23": [((100, 80, 50), (130, 255, 255))],  # 파랑
    "N25": [((20, 100, 100),(35, 255, 255))],   # 노랑
    "N27": [((40, 80, 50),  (80, 255, 255))],   # 초록
}

SEAT_COLORS_BGR = {
    "N22": (50,  50,  220),   # 빨강
    "N23": (220, 80,  50),    # 파랑
    "N25": (30,  210, 230),   # 노랑
    "N27": (60,  180, 60),    # 초록
}

VERTEX_RADIUS = 10   # 꼭짓점 핸들 크기 (px)
VERTEX_HIT    = 18   # 꼭짓점 클릭 판정 반경 (px)

DEFAULT_POLYGONS = {
    "N22": [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
    "N23": [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
    "N25": [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
    "N27": [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
}


def find_nearest_vertex(polygons: dict, x: int, y: int) -> tuple:
    """꼭짓점 중 VERTEX_HIT 반경 내 가장 가까운 것 반환 → (seat, vidx) or (None, None)"""
    best_dist = VERTEX_HIT
    best = (None, None)
    for seat, poly in polygons.items():
        if poly is None:
            continue
        for i, (vx, vy) in enumerate(poly):
            d = np.hypot(x - vx, y - vy)
            if d < best_dist:
                best_dist = d
                best = (seat, i)
    return best


def point_in_polygon(polygons: dict, x: int, y: int) -> str | None:
    """(x,y)가 속한 좌석 폴리곤 반환, 없으면 None"""
    for seat, poly in polygons.items():
        if poly is None:
            continue
        pts = poly.reshape(-1, 1, 2).astype(np.float32)
        if cv2.pointPolygonTest(pts, (float(x), float(y)), False) >= 0:
            return seat
    return None


def make_mouse_callback(polygons: dict, drag: dict):
    def callback(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            seat, vidx = find_nearest_vertex(polygons, x, y)
            if seat is not None:
                drag["mode"] = "vertex"
                drag["seat"] = seat
                drag["vidx"] = vidx
            else:
                seat = point_in_polygon(polygons, x, y)
                if seat is not None:
                    drag["mode"] = "poly"
                    drag["seat"] = seat
                    drag["last_xy"] = (x, y)

        elif event == cv2.EVENT_MOUSEMOVE:
            if drag["mode"] == "vertex" and drag["seat"] is not None:
                polygons[drag["seat"]][drag["vidx"]] = [
                    float(np.clip(x, 0, IMG_W - 1)),
                    float(np.clip(y, 0, IMG_H - 1)),
                ]
            elif drag["mode"] == "poly" and drag["seat"] is not None:
                dx = x - drag["last_xy"][0]
                dy = y - drag["last_xy"][1]
                poly = polygons[drag["seat"]] + np.array([dx, dy], dtype=np.float32)
                poly[:, 0] = np.clip(poly[:, 0], 0, IMG_W - 1)
                poly[:, 1] = np.clip(poly[:, 1], 0, IMG_H - 1)
                polygons[drag["seat"]] = poly
                drag["last_xy"] = (x, y)

        elif event == cv2.EVENT_LBUTTONUP:
            drag["mode"] = None
            drag["seat"] = None
            drag["vidx"] = None
            drag["last_xy"] = None

    return callback


def connect_rtsp() -> cv2.VideoCapture | None:
    print(f"RTSP 연결 중: {RTSP_URL}")
    cap = cv2.VideoCapture(RTSP_URL)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if cap.isOpened():
        ret, _ = cap.read()
        if ret:
            print("연결 성공!\n")
            return cap
    cap.release()
    print("  [오류] RTSP 연결 실패. RTSP_URL을 확인해주세요.")
    return None


def capture_avg_frame(cap: cv2.VideoCapture) -> np.ndarray:
    """CAPTURE_FRAMES 프레임을 float 평균해 노이즈 감소"""
    frames = []
    for _ in range(CAPTURE_FRAMES):
        ret, frame = cap.read()
        if ret:
            frames.append(cv2.resize(frame, (IMG_W, IMG_H)).astype(np.float32))
    if not frames:
        raise RuntimeError("프레임 캡처 실패")
    return np.clip(np.mean(frames, axis=0), 0, 255).astype(np.uint8)


def color_mask(hsv: np.ndarray, seat: str) -> np.ndarray:
    """해당 좌석의 HSV 범위 마스크 (여러 범위 OR 합산)"""
    mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
    for lo, hi in COLOR_RANGES[seat]:
        mask |= cv2.inRange(hsv, np.array(lo), np.array(hi))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask


def detect_paper_bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    """마스크에서 가장 큰 컨투어의 bounding box 반환 (x1, y1, x2, y2)"""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < 500:
        return None
    x, y, w, h = cv2.boundingRect(largest)
    return x, y, x + w, y + h


def bbox_to_desk_polygon(bbox: tuple[int, int, int, int],
                         scale: float) -> np.ndarray:
    """종이 bbox → scale배 확장한 책상 폴리곤 (4,2) ndarray, 이미지 경계 클리핑"""
    x1, y1, x2, y2 = bbox
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    hw = (x2 - x1) / 2 * scale
    hh = (y2 - y1) / 2 * scale
    poly = np.array([
        [cx - hw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh],
    ], dtype=np.float32)
    poly[:, 0] = np.clip(poly[:, 0], 0, IMG_W - 1)
    poly[:, 1] = np.clip(poly[:, 1], 0, IMG_H - 1)
    return poly


def detect_all(frame: np.ndarray,
               scale: float) -> dict[str, np.ndarray | None]:
    """각 좌석 색상 감지 → 책상 폴리곤 dict 반환 (미감지 좌석은 None)"""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    result: dict[str, np.ndarray | None] = {}
    for seat in SEATS:
        mask = color_mask(hsv, seat)
        bbox = detect_paper_bbox(mask)
        result[seat] = bbox_to_desk_polygon(bbox, scale) if bbox else None
    return result


def draw_dashed_poly(img: np.ndarray, pts: np.ndarray,
                     color: tuple, thickness: int = 2, gap: int = 12) -> None:
    """점선 폴리곤 (수동 배치 좌석용)"""
    n = len(pts)
    for i in range(n):
        p1 = pts[i][0].tolist()
        p2 = pts[(i + 1) % n][0].tolist()
        dist = np.hypot(p2[0] - p1[0], p2[1] - p1[1])
        if dist == 0:
            continue
        steps = int(dist / (gap * 2)) + 1
        for j in range(steps):
            t1 = min((j * 2 * gap) / dist, 1.0)
            t2 = min((j * 2 * gap + gap) / dist, 1.0)
            x1 = int(p1[0] + t1 * (p2[0] - p1[0]))
            y1 = int(p1[1] + t1 * (p2[1] - p1[1]))
            x2 = int(p1[0] + t2 * (p2[0] - p1[0]))
            y2 = int(p1[1] + t2 * (p2[1] - p1[1]))
            cv2.line(img, (x1, y1), (x2, y2), color, thickness)


def draw_preview(frame: np.ndarray,
                 polygons: dict[str, np.ndarray | None],
                 scale: float,
                 manual_seats: set | None = None) -> np.ndarray:
    vis = frame.copy()
    manual_seats = manual_seats or set()
    auto_detected, manually_placed = [], []

    for seat, poly in polygons.items():
        if poly is None:
            continue
        color = SEAT_COLORS_BGR[seat]
        is_manual = seat in manual_seats
        pts = poly.reshape(-1, 1, 2).astype(np.int32)

        overlay = vis.copy()
        cv2.fillPoly(overlay, [pts], color)
        alpha = 0.12 if is_manual else 0.25
        cv2.addWeighted(overlay, alpha, vis, 1 - alpha, 0, vis)

        if is_manual:
            draw_dashed_poly(vis, pts, color, thickness=2)
        else:
            cv2.polylines(vis, [pts], isClosed=True, color=color, thickness=2)

        cx = int(poly[:, 0].mean())
        cy = int(poly[:, 1].mean())
        label = f"{seat}{'(수동)' if is_manual else ''}"
        cv2.putText(vis, label, (cx - 30, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 3)
        cv2.putText(vis, label, (cx - 30, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)

        for vx, vy in poly:
            cv2.circle(vis, (int(vx), int(vy)), VERTEX_RADIUS, color, -1)
            cv2.circle(vis, (int(vx), int(vy)), VERTEX_RADIUS, (255, 255, 255), 1)

        if is_manual:
            manually_placed.append(seat)
        else:
            auto_detected.append(seat)

    bar_color = (0, 180, 0) if not manually_placed else (0, 140, 220)
    cv2.rectangle(vis, (0, 0), (IMG_W, 50), (20, 20, 20), -1)
    status = f"자동감지: {auto_detected}  |  수동배치: {manually_placed if manually_placed else '없음'}"
    cv2.putText(vis, status, (8, 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, bar_color, 1)
    guide = f"scale={scale:.1f}  |  '+'/'-':크기  'r':재캡처  's':저장  'q':취소  |  마우스: 꼭짓점/폴리곤 드래그"
    cv2.putText(vis, guide, (8, 42),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 180, 180), 1)
    return vis


def save_calibration(polygons: dict[str, np.ndarray | None]) -> None:
    final: dict[str, np.ndarray] = {}
    for seat in SEATS:
        if polygons[seat] is not None:
            final[seat] = polygons[seat]
        else:
            print(f"  [경고] {seat} 미감지 → 기본 폴리곤 적용")
            final[seat] = np.array(
                [[p[0] * IMG_W, p[1] * IMG_H] for p in DEFAULT_POLYGONS[seat]],
                dtype=np.float32,
            )
    np.savez(str(CALIB_FILE), **final)
    print(f"\n저장 완료: {CALIB_FILE}")
    for seat, poly in final.items():
        p = poly.astype(int)
        print(f"  {seat}: TL{p[0].tolist()} TR{p[1].tolist()} BR{p[2].tolist()} BL{p[3].tolist()}")


def main():
    print("=" * 55)
    print("  색깔 종이 기반 좌석 캘리브레이션")
    print("=" * 55)
    print("  N22=빨강  N23=파랑  N25=노랑  N27=초록")
    print("  책상 중앙에 각 색지를 놓고 실행하세요\n")

    cap = connect_rtsp()
    if cap is None:
        return

    scale = DESK_SCALE
    frame = capture_avg_frame(cap)

    def apply_detection(raw: dict, existing: dict, manual: set) -> None:
        """detect_all 결과를 existing에 in-place 반영. 미감지 좌석은 기본 폴리곤으로 채움."""
        for seat in SEATS:
            if raw[seat] is not None:
                existing[seat] = raw[seat]
                manual.discard(seat)
            elif existing.get(seat) is None:
                # 감지 실패 → 기본 폴리곤 배치 (수동 조정 가능)
                existing[seat] = np.array(
                    [[p[0] * IMG_W, p[1] * IMG_H] for p in DEFAULT_POLYGONS[seat]],
                    dtype=np.float32,
                )
                manual.add(seat)

    polygons: dict[str, np.ndarray | None] = {s: None for s in SEATS}
    manual_seats: set[str] = set()
    apply_detection(detect_all(frame, scale), polygons, manual_seats)

    print(f"자동감지: { [s for s in SEATS if s not in manual_seats] }  "
          f"수동배치(기본값): { list(manual_seats) }")
    print("창에서 폴리곤을 확인하고 키를 입력하세요.")
    print("수동배치 좌석(점선)은 마우스로 원하는 위치/크기로 조정 후 's'로 저장하세요.")
    print("마우스: 꼭짓점(원) 드래그=개별조정 / 폴리곤 내부 드래그=전체이동\n")

    WIN = "Color Calibration — s:저장 / +/-:크기 / r:재캡처 / q:취소"
    drag = {"mode": None, "seat": None, "vidx": None, "last_xy": None}
    cv2.namedWindow(WIN)
    cv2.setMouseCallback(WIN, make_mouse_callback(polygons, drag))

    while True:
        vis = draw_preview(frame, polygons, scale, manual_seats)
        cv2.imshow(WIN, vis)
        key = cv2.waitKey(30) & 0xFF

        if key == ord('s'):
            save_calibration(polygons)
            print("\n다음 단계: 색지를 치우고 아래 명령어로 모니터링을 시작하세요")
            print("  python seat_detector.py")
            break

        elif key == ord('+') or key == ord('='):
            scale = round(scale + SCALE_STEP, 1)
            apply_detection(detect_all(frame, scale), polygons, manual_seats)
            print(f"\r  scale → {scale:.1f}", end="", flush=True)

        elif key == ord('-'):
            scale = max(round(scale - SCALE_STEP, 1), 0.5)
            apply_detection(detect_all(frame, scale), polygons, manual_seats)
            print(f"\r  scale → {scale:.1f}", end="", flush=True)

        elif key == ord('r'):
            print("\n재캡처 중...")
            frame = capture_avg_frame(cap)
            apply_detection(detect_all(frame, scale), polygons, manual_seats)
            print(f"재캡처 완료. 자동감지: { [s for s in SEATS if s not in manual_seats] }  수동: { list(manual_seats) }")

        elif key == ord('q'):
            print("\n취소됨.")
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

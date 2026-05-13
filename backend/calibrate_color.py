"""
calibrate_color.py — 색깔 종이 기반 좌석 캘리브레이션

준비물: 좌석마다 다른 색 A4 종이를 책상 중앙에 놓기
  N22 = 빨강  |  N23 = 파랑  |  N25 = 노랑  |  N27 = 초록

실행: python calibrate_color.py
키:  's' 저장  |  '+'/'-' 폴리곤 크기 조정  |  'r' 재캡처  |  'q' 취소
"""

import cv2
import numpy as np
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE       = Path(__file__).parent
CALIB_FILE = BASE / "calibration.npz"
RTSP_URL   = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.17.239.85/stream1")

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

DEFAULT_POLYGONS = {
    "N22": [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
    "N23": [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
    "N25": [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
    "N27": [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
}


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


def draw_preview(frame: np.ndarray,
                 polygons: dict[str, np.ndarray | None],
                 scale: float) -> np.ndarray:
    vis = frame.copy()
    detected, missing = [], []

    for seat, poly in polygons.items():
        color = SEAT_COLORS_BGR[seat]
        if poly is not None:
            pts = poly.reshape(-1, 1, 2).astype(np.int32)
            overlay = vis.copy()
            cv2.fillPoly(overlay, [pts], color)
            cv2.addWeighted(overlay, 0.25, vis, 0.75, 0, vis)
            cv2.polylines(vis, [pts], isClosed=True, color=color, thickness=2)
            cx = int(poly[:, 0].mean())
            cy = int(poly[:, 1].mean())
            cv2.putText(vis, seat, (cx - 18, cy),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 3)
            cv2.putText(vis, seat, (cx - 18, cy),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            detected.append(seat)
        else:
            missing.append(seat)

    bar_color = (0, 180, 0) if not missing else (0, 140, 220)
    cv2.rectangle(vis, (0, 0), (IMG_W, 50), (20, 20, 20), -1)
    status = f"감지: {detected}  |  미감지: {missing if missing else '없음'}"
    cv2.putText(vis, status, (8, 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, bar_color, 1)
    guide = f"scale={scale:.1f}  |  '+'/'-': 크기조정  's': 저장  'r': 재캡처  'q': 취소"
    cv2.putText(vis, guide, (8, 42),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)
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
    polygons = detect_all(frame, scale)

    print(f"감지 결과: { {s: ('O' if p is not None else 'X') for s, p in polygons.items()} }")
    print("창에서 폴리곤을 확인하고 키를 입력하세요.\n")

    while True:
        vis = draw_preview(frame, polygons, scale)
        cv2.imshow("Color Calibration — s:저장 / +/-:크기 / r:재캡처 / q:취소", vis)
        key = cv2.waitKey(30) & 0xFF

        if key == ord('s'):
            save_calibration(polygons)
            print("\n다음 단계: 색지를 치우고 아래 명령어로 모니터링을 시작하세요")
            print("  python seat_detector.py")
            break

        elif key == ord('+') or key == ord('='):
            scale = round(scale + SCALE_STEP, 1)
            polygons = detect_all(frame, scale)
            print(f"\r  scale → {scale:.1f}", end="", flush=True)

        elif key == ord('-'):
            scale = max(round(scale - SCALE_STEP, 1), 0.5)
            polygons = detect_all(frame, scale)
            print(f"\r  scale → {scale:.1f}", end="", flush=True)

        elif key == ord('r'):
            print("\n재캡처 중...")
            frame = capture_avg_frame(cap)
            polygons = detect_all(frame, scale)
            print(f"재캡처 완료. 감지: { {s: ('O' if p is not None else 'X') for s, p in polygons.items()} }")

        elif key == ord('q'):
            print("\n취소됨.")
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

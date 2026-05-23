"""
calibrate_drag.py - 4-corner drag ROI calibration
Usage : python calibrate_drag.py
Order : N23 -> N22 -> N25 -> N27
Controls: drag corners with mouse  |  SPACE = confirm  |  ESC = skip seat
"""

import cv2
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Dict, List
import os

load_dotenv()

BASE       = Path(__file__).parent
CALIB_FILE = BASE / "calibration.npz"
RTSP_URL   = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.63.75.85/stream1")

SEATS_ORDER = ["N23", "N22", "N25", "N27"]
SEAT_COLORS = {
    "N23": (245, 158,  11),
    "N27": ( 34, 197,  94),
    "N22": ( 59, 130, 246),
    "N25": (168,  85, 247),
}
IMG_W, IMG_H = 960, 720
POINT_R      = 10
SNAP_DIST    = 20

DEFAULT_CORNERS: Dict[str, List] = {
    "N23": [[100,  60], [460,  60], [460, 370], [100, 370]],
    "N22": [[100, 370], [460, 370], [460, 660], [100, 660]],
    "N25": [[500, 370], [860, 370], [860, 660], [500, 660]],
    "N27": [[500,  60], [860,  60], [860, 370], [500, 370]],
}

WIN = "Seat ROI Calibration"


def get_frame() -> Optional[np.ndarray]:
    print(f"Connecting: {RTSP_URL}")
    cap = cv2.VideoCapture(RTSP_URL)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    for _ in range(5):
        cap.read()
    ret, frame = cap.read()
    cap.release()
    if ret:
        return cv2.resize(frame, (IMG_W, IMG_H))
    print("Camera connection failed.")
    return None


def draw_scene(base: np.ndarray,
               done: Dict[str, np.ndarray],
               seat: str,
               pts: List[List[int]],
               dragging: int) -> np.ndarray:
    out = base.copy()

    for s, poly in done.items():
        c       = SEAT_COLORS[s]
        overlay = out.copy()
        cv2.fillPoly(overlay, [poly.reshape(-1, 1, 2).astype(np.int32)], c)
        cv2.addWeighted(overlay, 0.25, out, 0.75, 0, out)
        cv2.polylines(out, [poly.reshape(-1, 1, 2).astype(np.int32)], True, c, 2)
        cx = int(poly[:, 0].mean())
        cy = int(poly[:, 1].mean())
        cv2.putText(out, s, (cx - 22, cy + 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)

    color   = SEAT_COLORS[seat]
    pts_np  = np.array(pts, dtype=np.int32)
    overlay = out.copy()
    cv2.fillPoly(overlay, [pts_np.reshape(-1, 1, 2)], color)
    cv2.addWeighted(overlay, 0.35, out, 0.65, 0, out)
    cv2.polylines(out, [pts_np.reshape(-1, 1, 2)], True, color, 2)

    corner_labels = ["TL", "TR", "BR", "BL"]
    for i, (px, py) in enumerate(pts):
        fill = (255, 255, 255) if i == dragging else color
        cv2.circle(out, (px, py), POINT_R, fill, -1)
        cv2.circle(out, (px, py), POINT_R, (255, 255, 255), 2)
        cv2.putText(out, corner_labels[i], (px + 12, py - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    cx = sum(p[0] for p in pts) // 4
    cy = sum(p[1] for p in pts) // 4
    cv2.putText(out, seat, (cx - 25, cy + 10),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 3, cv2.LINE_AA)
    cv2.putText(out, seat, (cx - 25, cy + 10),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, color, 2, cv2.LINE_AA)

    step  = SEATS_ORDER.index(seat) + 1
    total = len(SEATS_ORDER)
    msg   = f"[{step}/{total}] {seat} : Drag corners to fit seat  |  SPACE = confirm  |  ESC = skip"
    cv2.rectangle(out, (0, 0), (IMG_W, 50), (30, 30, 30), -1)
    cv2.putText(out, msg, (10, 34),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2, cv2.LINE_AA)

    return out


class _State:
    pts: List[List[int]] = []
    dragging: int = -1


def _make_callback(state: _State):
    def cb(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            for i, (px, py) in enumerate(state.pts):
                if ((px - x)**2 + (py - y)**2) ** 0.5 < SNAP_DIST:
                    state.dragging = i
                    break
        elif event == cv2.EVENT_MOUSEMOVE and state.dragging >= 0:
            state.pts[state.dragging] = [
                max(0, min(IMG_W - 1, x)),
                max(0, min(IMG_H - 1, y)),
            ]
        elif event == cv2.EVENT_LBUTTONUP:
            state.dragging = -1
    return cb


def calibrate_seat(base: np.ndarray,
                   seat: str,
                   done: Dict[str, np.ndarray]) -> Optional[np.ndarray]:
    state = _State()
    state.pts = [list(p) for p in DEFAULT_CORNERS[seat]]

    cv2.namedWindow(WIN)
    cv2.setMouseCallback(WIN, _make_callback(state))

    while True:
        frame = draw_scene(base, done, seat, state.pts, state.dragging)
        cv2.imshow(WIN, frame)
        key = cv2.waitKey(16) & 0xFF

        if key == ord(' ') or key == 13:
            return np.array(state.pts, dtype=np.float32)
        elif key == 27:
            print(f"  {seat}: skipped")
            return None

    return None


def main():
    frame = get_frame()
    if frame is None:
        return

    done: Dict[str, np.ndarray] = {}

    for seat in SEATS_ORDER:
        print(f"  Setting ROI for {seat} ...")
        pts = calibrate_seat(frame, seat, done)
        if pts is not None:
            done[seat] = pts
            print(f"  {seat}: confirmed")

    cv2.destroyAllWindows()

    if not done:
        print("No ROI saved.")
        return

    np.savez(str(CALIB_FILE), **done)
    print(f"\nSaved: {CALIB_FILE}")

    result = draw_scene(frame, done, list(done.keys())[-1],
                        done[list(done.keys())[-1]].tolist(), -1)
    # 결과 미리보기
    result = frame.copy()
    for s, poly in done.items():
        c       = SEAT_COLORS[s]
        overlay = result.copy()
        cv2.fillPoly(overlay, [poly.reshape(-1, 1, 2).astype(np.int32)], c)
        cv2.addWeighted(overlay, 0.4, result, 0.6, 0, result)
        cv2.polylines(result, [poly.reshape(-1, 1, 2).astype(np.int32)], True, c, 2)
        cx = int(poly[:, 0].mean())
        cy = int(poly[:, 1].mean())
        cv2.putText(result, s, (cx - 22, cy + 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)

    cv2.rectangle(result, (0, 0), (IMG_W, 50), (30, 30, 30), -1)
    cv2.putText(result, "Calibration complete!  Press any key to exit.",
                (10, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 220, 0), 2, cv2.LINE_AA)
    cv2.imshow("Result", result)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

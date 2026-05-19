"""
detect_roi.py - ROI 기반 좌석 객체인식 테스트 (Supabase 없음)
Usage: python detect_roi.py
"""

import cv2
import numpy as np
import time
from pathlib import Path
from ultralytics import YOLO

BASE       = Path(__file__).parent
CALIB_FILE = BASE / "calibration.npz"
RTSP_URL   = "rtsp://tapo1234:123456788@10.112.80.85/stream1"

SEATS      = ["N23", "N22", "N25", "N27"]
SEAT_COLORS = {
    "N23": (245, 158,  11),
    "N27": ( 34, 197,  94),
    "N22": ( 59, 130, 246),
    "N25": (168,  85, 247),
}
ITEM_LABELS  = {"laptop", "keyboard", "book", "cup", "backpack", "bag", "cell phone", "mouse", "bottle"}
IMG_W, IMG_H = 960, 720
CONFIRM_SEC  = 3.0   # 같은 상태 N초 유지해야 반영

DEFAULT_POLYGONS = {
    "N23": np.array([[  0,   0],[480,   0],[480, 360],[  0, 360]], dtype=np.float32),
    "N27": np.array([[480,   0],[960,   0],[960, 360],[480, 360]], dtype=np.float32),
    "N22": np.array([[  0, 360],[480, 360],[480, 720],[  0, 720]], dtype=np.float32),
    "N25": np.array([[480, 360],[960, 360],[960, 720],[480, 720]], dtype=np.float32),
}


def load_calibration():
    if not CALIB_FILE.exists():
        print("[WARNING] calibration.npz not found -> using default grid")
        return DEFAULT_POLYGONS
    data  = np.load(str(CALIB_FILE))
    polys = {s: data[s] for s in SEATS if s in data}
    for s in SEATS:
        if s not in polys:
            polys[s] = DEFAULT_POLYGONS[s]
    print(f"Calibration loaded: {CALIB_FILE}")
    return polys


def get_seat(px, py, polys):
    """포인트가 속한 ROI 반환, ROI 밖이면 None"""
    for seat, poly in polys.items():
        pts = poly.reshape(-1, 1, 2).astype(np.float32)
        if cv2.pointPolygonTest(pts, (float(px), float(py)), False) >= 0:
            return seat
    return None


def draw_zones(frame, polys, results):
    for seat, poly in polys.items():
        has_person, has_items = results.get(seat, (False, False))
        if has_person:   status, alpha = "occupied", 0.35
        elif has_items:  status, alpha = "reserved", 0.30
        else:            status, alpha = "available", 0.08

        color   = SEAT_COLORS[seat]
        pts     = poly.reshape(-1, 1, 2).astype(np.int32)
        overlay = frame.copy()
        cv2.fillPoly(overlay, [pts], color)
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        cv2.polylines(frame, [pts], True, color, 2)

        cx = int(poly[:, 0].mean())
        cy = int(poly[:, 1].mean())
        label = f"{seat}: {status}"
        cv2.putText(frame, label, (cx - 50, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, label, (cx - 50, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA)


def main():
    polys = load_calibration()
    model = YOLO("yolov8s.pt")

    print(f"Connecting: {RTSP_URL}")
    cap = cv2.VideoCapture(RTSP_URL)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    for _ in range(5):
        cap.read()

    if not cap.isOpened():
        print("Camera connection failed.")
        return
    print("Connected! (press Q to quit)\n" + "-" * 50)

    # 확정 지연 필터 상태
    filter_state = {
        s: {"buf": (False, False), "confirmed": (False, False), "since": time.time()}
        for s in SEATS
    }

    def confirm(seat, has_person, has_items):
        s   = filter_state[seat]
        new = (has_person, has_items)
        if new != s["buf"]:
            s["buf"]   = new
            s["since"] = time.time()
        elif time.time() - s["since"] >= CONFIRM_SEC:
            s["confirmed"] = new
        return s["confirmed"]

    seat_results = {s: (False, False) for s in SEATS}
    last_print   = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Frame read failed.")
            break

        frame = cv2.resize(frame, (IMG_W, IMG_H))
        det   = model(frame, verbose=False)[0]

        raw = {s: {"person": False, "items": False} for s in SEATS}

        seat_labels = {s: {"person": False, "items": []} for s in SEATS}
        for box in det.boxes:
            cls   = int(box.cls[0])
            label = model.names[cls]
            conf  = float(box.conf[0])
            if conf < 0.3:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            if label == "person":
                px, py = (x1 + x2) / 2, (y1 + y2) / 2
                seat   = get_seat(px, py, polys)
                if seat:
                    raw[seat]["person"] = True
                    seat_labels[seat]["person"] = True
            elif label in ITEM_LABELS:
                px, py = (x1 + x2) / 2, float(y2)
                seat   = get_seat(px, py, polys)
                if seat:
                    raw[seat]["items"] = True
                    seat_labels[seat]["items"].append(label)

        seat_results = {s: confirm(s, raw[s]["person"], raw[s]["items"]) for s in SEATS}

        now = time.time()
        if now - last_print >= 1.0:
            last_print = now
            ts = time.strftime("%H:%M:%S")
            parts = []
            for s, (has_p, has_i) in seat_results.items():
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

        SHOW_LABELS = ITEM_LABELS | {"person"}
        annotated = det.plot(conf=True, labels=True)
        # 관련 없는 bbox 제거 — 빈 프레임에 직접 그리기
        annotated = frame.copy()
        for box in det.boxes:
            cls   = int(box.cls[0])
            label = model.names[cls]
            conf  = float(box.conf[0])
            if conf < 0.3 or label not in SHOW_LABELS:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            color = (0, 255, 0) if label == "person" else (255, 200, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated, f"{label} {conf:.0%}", (x1, y1 - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)
        draw_zones(annotated, polys, seat_results)
        cv2.imshow("Seat Detection (Q: quit)", annotated)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("Done.")


if __name__ == "__main__":
    main()

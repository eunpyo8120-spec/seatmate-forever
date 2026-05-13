"""
test_aruco.py — ArUco 마커 감지 테스트
실행: python test_aruco.py
종료: q 키
"""

import cv2
import numpy as np
from dotenv import load_dotenv
import os

load_dotenv()

RTSP_URL = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.17.239.85/stream1")

ARUCO_DICT = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
ARUCO_PARAMS = cv2.aruco.DetectorParameters()
DETECTOR = cv2.aruco.ArucoDetector(ARUCO_DICT, ARUCO_PARAMS)

# ID → 좌석-코너 매핑
ID_MAP = {
    1: "N22-TL", 2: "N22-TR", 3: "N22-BR", 4: "N22-BL",
    5: "N23-TL", 6: "N23-TR", 7: "N23-BR", 8: "N23-BL",
    9: "N25-TL",10: "N25-TR",11: "N25-BR",12: "N25-BL",
   13: "N27-TL",14: "N27-TR",15: "N27-BR",16: "N27-BL",
}

SEAT_COLORS = {
    "N22": (34, 197, 94),
    "N23": (68, 68, 239),
    "N25": (11, 158, 245),
    "N27": (246, 130, 59),
}

print(f"RTSP 연결 중: {RTSP_URL}")
cap = cv2.VideoCapture(RTSP_URL)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("연결 실패. RTSP_URL을 확인해주세요.")
    exit(1)

print("연결 성공! q 키로 종료\n")

while True:
    ret, frame = cap.read()
    if not ret:
        print("프레임 읽기 실패")
        break

    frame = cv2.resize(frame, (960, 720))
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    corners, ids, _ = DETECTOR.detectMarkers(gray)

    detected_labels = []

    if ids is not None:
        cv2.aruco.drawDetectedMarkers(frame, corners, ids)
        for i, marker_id in enumerate(ids.flatten()):
            label = ID_MAP.get(marker_id, f"ID{marker_id}(미등록)")
            seat = label.split("-")[0] if "-" in label else None
            color = SEAT_COLORS.get(seat, (255, 255, 255)) if seat else (255, 255, 255)

            c = corners[i][0]
            cx, cy = int(c[:, 0].mean()), int(c[:, 1].mean())
            cv2.putText(frame, label, (cx - 35, cy - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3)
            cv2.putText(frame, label, (cx - 35, cy - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            detected_labels.append(label)

        status_text = f"감지: {len(ids)}개 — {', '.join(detected_labels)}"
        color_bar = (0, 200, 0)
    else:
        status_text = "감지된 마커 없음"
        color_bar = (0, 0, 200)

    cv2.rectangle(frame, (0, 0), (960, 30), (0, 0, 0), -1)
    cv2.putText(frame, status_text, (8, 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color_bar, 2)

    print(f"\r{status_text}          ", end="", flush=True)

    cv2.imshow("ArUco Test — q: 종료", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("\n종료됨.")

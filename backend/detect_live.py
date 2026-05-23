"""
Tapo RTSP → YOLOv8 실시간 감지
실행: python detect_live.py
종료: 영상 창에서 q 키
"""
import cv2
import time
from ultralytics import YOLO

RTSP_CANDIDATES = [
    "rtsp://tapo1234:123456788@10.63.75.85/stream1",
    "rtsp://tapo1234:123456788@10.17.239.85/stream1",
    "rtsp://tapo1234:123456788@10.91.195.85/stream1",
]

model = YOLO("yolov8n.pt")


def find_rtsp():
    for url in RTSP_CANDIDATES:
        print(f"연결 시도: {url}")
        cap = cv2.VideoCapture(url)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print(f"연결 성공!\n")
                return cap
        cap.release()
    return None


cap = find_rtsp()
if cap is None:
    print("RTSP 연결 실패. 카메라 IP를 확인하세요.")
    exit(1)

print("감지 시작 (영상 창에서 q 누르면 종료)\n")
print("-" * 60)

last_print = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("프레임 읽기 실패. 종료합니다.")
        break

    results = model(frame, verbose=False)[0]

    persons = []
    items = []

    for box in results.boxes:
        cls = int(box.cls[0])
        label = model.names[cls]
        conf = float(box.conf[0])

        if label == "person":
            persons.append(conf)
        else:
            items.append((label, conf))

    # 1초마다 터미널 출력
    now = time.time()
    if now - last_print >= 1.0:
        last_print = now
        ts = time.strftime("%H:%M:%S")

        person_str = f"{len(persons)}명" if persons else "없음"
        if persons:
            avg_conf = sum(persons) / len(persons)
            person_str += f" ({avg_conf*100:.0f}%)"

        if items:
            item_str = ", ".join(
                f"{label} {conf*100:.0f}%"
                for label, conf in sorted(items, key=lambda x: -x[1])
            )
        else:
            item_str = "없음"

        print(f"[{ts}] 사람: {person_str}  |  물체: {item_str}")

    # 화면에 바운딩 박스 표시
    annotated = results.plot()
    cv2.imshow("Tapo YOLO 감지 (q: 종료)", annotated)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print("\n종료됨.")

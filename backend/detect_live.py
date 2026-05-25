"""
Tapo RTSP ??YOLOv8 ?ㅼ떆媛?媛먯?
?ㅽ뻾: python detect_live.py
醫낅즺: ?곸긽 李쎌뿉??q ??
"""
import cv2
import time
from ultralytics import YOLO

RTSP_CANDIDATES = [
    "rtsp://tapo1234:123456788@10.237.232.85/stream1",
    "rtsp://tapo1234:123456788@10.17.239.85/stream1",
    "rtsp://tapo1234:123456788@10.91.195.85/stream1",
]

model = YOLO("yolov8n.pt")


def find_rtsp():
    for url in RTSP_CANDIDATES:
        print(f"?곌껐 ?쒕룄: {url}")
        cap = cv2.VideoCapture(url)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print(f"?곌껐 ?깃났!\n")
                return cap
        cap.release()
    return None


cap = find_rtsp()
if cap is None:
    print("RTSP ?곌껐 ?ㅽ뙣. 移대찓??IP瑜??뺤씤?섏꽭??")
    exit(1)

print("媛먯? ?쒖옉 (?곸긽 李쎌뿉??q ?꾨Ⅴ硫?醫낅즺)\n")
print("-" * 60)

last_print = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("?꾨젅???쎄린 ?ㅽ뙣. 醫낅즺?⑸땲??")
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

    # 1珥덈쭏???곕???異쒕젰
    now = time.time()
    if now - last_print >= 1.0:
        last_print = now
        ts = time.strftime("%H:%M:%S")

        person_str = f"{len(persons)}紐? if persons else "?놁쓬"
        if persons:
            avg_conf = sum(persons) / len(persons)
            person_str += f" ({avg_conf*100:.0f}%)"

        if items:
            item_str = ", ".join(
                f"{label} {conf*100:.0f}%"
                for label, conf in sorted(items, key=lambda x: -x[1])
            )
        else:
            item_str = "?놁쓬"

        print(f"[{ts}] ?щ엺: {person_str}  |  臾쇱껜: {item_str}")

    # ?붾㈃??諛붿슫??諛뺤뒪 ?쒖떆
    annotated = results.plot()
    cv2.imshow("Tapo YOLO 媛먯? (q: 醫낅즺)", annotated)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print("\n醫낅즺??")

import cv2, requests

RTSP_LIST = [
    "rtsp://tapo1234:123456788@10.17.239.85/stream1",
    "rtsp://tapo1234:123456788@10.91.195.85/stream1",
]
EC2 = "http://13.239.60.158:8000"

print("카메라 연결 중...")
cap = None
ret, frame = False, None
for rtsp in RTSP_LIST:
    print(f"  시도: {rtsp}")
    c = cv2.VideoCapture(rtsp)
    if c.isOpened():
        r, f = c.read()
        if r:
            cap, ret, frame = c, r, f
            print("  연결 성공")
            c.release()
            break
    c.release()

if not ret:
    print("카메라 연결 실패")
    exit(1)

print("EC2에 분석 요청 중...")
_, img_encoded = cv2.imencode(".jpg", frame)
resp = requests.post(
    f"{EC2}/detect",
    files={"file": ("frame.jpg", img_encoded.tobytes(), "image/jpeg")},
    timeout=20,
)
d = resp.json()
persons = [x for x in d.get("detected", []) if x["label"] == "person"]
others  = [x for x in d.get("detected", []) if x["label"] != "person"]

print(f"\n현재 사람 수: {len(persons)}명")
for i, p in enumerate(persons, 1):
    conf = int(p["confidence"] * 100)
    print(f"  사람 {i}: 신뢰도 {conf}%")
if others:
    labels = ", ".join(f"{x['label']}({x['confidence']})" for x in others)
    print(f"기타 감지 객체: {labels}")

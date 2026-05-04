"""
로컬 PC에서 실행 (Tapo 카메라와 같은 네트워크)
설치: pip install opencv-python requests
실행: python local_client.py
"""
import cv2
import requests
import time
import sys
import os

EC2_URL = "http://13.239.60.158:8000"
INTERVAL = 5  # 몇 초마다 분석할지

RTSP_CANDIDATES = [
    "rtsp://tapo1234:123456788@10.17.239.85/stream1",
    "rtsp://tapo1234:123456788@10.91.195.85/stream1",
]


def find_rtsp():
    for url in RTSP_CANDIDATES:
        print(f"연결 시도: {url}")
        cap = cv2.VideoCapture(url)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print(f"연결 성공: {url}")
                return cap
        cap.release()
    return None


def save_reference(frame):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reference.jpg")
    cv2.imwrite(path, frame)
    print(f"참조 이미지 저장됨 → {path}")


def detect_person(frame):
    _, img_encoded = cv2.imencode(".jpg", frame)
    try:
        resp = requests.post(
            f"{EC2_URL}/detect",
            files={"file": ("frame.jpg", img_encoded.tobytes(), "image/jpeg")},
            timeout=20,
        )
        if resp.ok:
            d = resp.json()
            detected_labels = [f"{x['label']}({x['confidence']})" for x in d.get("detected", [])]
            label_str = ", ".join(detected_labels) if detected_labels else "없음"
            print(f"  사람 감지: {d['has_person']} | 감지된 객체: {label_str}")
        else:
            print(f"  오류: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"  전송 실패: {e}")


def main():
    try:
        r = requests.get(f"{EC2_URL}/health", timeout=5)
        print(f"EC2 연결 확인: {r.json()}")
    except Exception as e:
        print(f"EC2 연결 실패: {e}")
        sys.exit(1)

    cap = find_rtsp()
    if cap is None:
        print("RTSP 연결 실패. 카메라 IP와 자격증명을 확인하세요.")
        sys.exit(1)

    frame_count = 0
    print(f"\n사람 감지 시작 (매 {INTERVAL}초마다)\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("프레임 읽기 실패. 재연결...")
            cap.release()
            time.sleep(3)
            cap = find_rtsp()
            if cap is None:
                break
            continue

        if frame_count == 0:
            save_reference(frame)

        print(f"[{time.strftime('%H:%M:%S')}] 분석 중...")
        detect_person(frame)

        frame_count += 1
        time.sleep(INTERVAL)

    cap.release()


if __name__ == "__main__":
    main()

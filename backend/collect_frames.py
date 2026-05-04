"""
collect_frames.py — RTSP 스트림에서 YOLOv8-Pose 학습용 프레임 수집
실행: python collect_frames.py
옵션: python collect_frames.py --interval 3   (3초마다 저장, 기본 5초)
      python collect_frames.py --target 300   (목표 프레임 수, 기본 200)
종료: 영상 창에서 q 키
"""

import cv2
import time
import argparse
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

RTSP_URL = os.getenv("RTSP_URL", "rtsp://tapo1234:123456788@10.17.239.85/stream1")
IMG_W, IMG_H = 960, 720
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data", "raw_frames")


def find_rtsp() -> cv2.VideoCapture | None:
    print(f"RTSP 연결 시도: {RTSP_URL}")
    cap = cv2.VideoCapture(RTSP_URL)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if cap.isOpened():
        ret, _ = cap.read()
        if ret:
            print("연결 성공!\n")
            return cap
    cap.release()
    print("연결 실패.")
    return None


def main():
    parser = argparse.ArgumentParser(description="RTSP 프레임 수집기")
    parser.add_argument("--interval", type=float, default=5.0, help="저장 간격(초), 기본 5")
    parser.add_argument("--target", type=int, default=200, help="목표 프레임 수, 기본 200")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 55)
    print("  YOLOv8-Pose 학습용 프레임 수집기")
    print("=" * 55)
    print(f"  저장 경로  : {OUTPUT_DIR}")
    print(f"  저장 간격  : {args.interval}초")
    print(f"  목표 프레임: {args.target}장")
    print()
    print("[수집 가이드 -- 각 상태별 50장씩]")
    print("  1. 일부 좌석만 비어있는 상태")
    print("     (N22/N23/N25/N27 중 최소 1개 빈 좌석 포함)")
    print("  2. 1~2명 착석 상태")
    print("  3. 물건만 있는 상태 (가방, 노트북)")
    print("  4. 여러 명 혼합 상태")
    print("  ※ 도서관 개관 중 수집 가능 -- '전체 빈 좌석' 불필요")
    print()
    print("  종료: 영상 창에서 q 키")
    print("-" * 55)

    cap = find_rtsp()
    if cap is None:
        return

    count = 0
    last_save = time.time() - args.interval  # 시작하자마자 첫 프레임 저장

    while True:
        ret, frame = cap.read()
        if not ret:
            print("프레임 읽기 실패. 3초 후 재연결...")
            cap.release()
            time.sleep(3)
            cap = find_rtsp()
            if cap is None:
                break
            continue

        frame = cv2.resize(frame, (IMG_W, IMG_H))

        now = time.time()
        if now - last_save >= args.interval:
            last_save = now
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = os.path.join(OUTPUT_DIR, f"{ts}_{count:04d}.jpg")
            cv2.imwrite(filename, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            count += 1
            remaining = args.target - count
            bar = "#" * min(count, 40) + "." * max(0, 40 - count)
            pct = min(100, int(count / args.target * 100))
            print(f"\r  [{bar}] {pct:3d}%  {count}/{args.target}장  남은: {remaining}장  ", end="", flush=True)

            if count >= args.target:
                print(f"\n\n목표 {args.target}장 수집 완료!")
                break

        # 미리보기 — 현재 저장 카운트 표시
        preview = frame.copy()
        cv2.putText(preview, f"Saved: {count}/{args.target}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        next_save_in = max(0.0, args.interval - (time.time() - last_save))
        cv2.putText(preview, f"Next save: {next_save_in:.1f}s",
                    (10, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        cv2.imshow("Frame Collector (q: 종료)", preview)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print(f"\n수집 종료. 총 {count}장 저장 → {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

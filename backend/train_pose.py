"""
train_pose.py — YOLOv8-Pose 파인튜닝
좌석 코너 키포인트(TL/TR/BR/BL) × 4클래스(N22/N23/N25/N27) 학습

사용법:
  python train_pose.py            # 기본 설정으로 학습
  python train_pose.py --epochs 100 --batch 16
  python train_pose.py --resume   # 마지막 체크포인트에서 이어서

결과:
  runs/pose/seatN/weights/best.pt  -- 최종 사용 모델
"""

import argparse
from pathlib import Path
from ultralytics import YOLO

BASE        = Path(__file__).parent
DATASET_DIR = BASE / "data" / "dataset"
YAML_PATH   = DATASET_DIR / "dataset.yaml"
RUNS_DIR    = BASE / "runs" / "pose"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=150,
                        help="학습 에폭 수 (기본 150)")
    parser.add_argument("--batch",  type=int, default=8,
                        help="배치 크기 (GPU 메모리에 맞게 조정, 기본 8)")
    parser.add_argument("--imgsz",  type=int, default=640,
                        help="입력 이미지 크기 (기본 640)")
    parser.add_argument("--resume", action="store_true",
                        help="마지막 체크포인트에서 이어서 학습")
    parser.add_argument("--device", type=str, default="",
                        help="학습 장치 (빈값=자동, '0'=GPU 0, 'cpu'=CPU)")
    args = parser.parse_args()

    if not YAML_PATH.exists():
        print(f"ERROR: dataset.yaml 없음 → 먼저 label_seats.py 실행")
        return

    # 이어서 학습할 체크포인트 찾기
    last_ckpt = None
    if args.resume:
        ckpts = sorted(RUNS_DIR.glob("seat*/weights/last.pt"))
        if ckpts:
            last_ckpt = ckpts[-1]
            print(f"이어서 학습: {last_ckpt}")
        else:
            print("체크포인트 없음 — 처음부터 학습합니다")

    model = YOLO(str(last_ckpt) if last_ckpt else "yolov8s-pose.pt")

    print("=" * 55)
    print("  YOLOv8-Pose 학습 시작")
    print("=" * 55)
    print(f"  데이터셋 : {YAML_PATH}")
    print(f"  에폭    : {args.epochs}")
    print(f"  배치    : {args.batch}")
    print(f"  이미지  : {args.imgsz}px")
    print(f"  장치    : {args.device or '자동'}")
    print("-" * 55)

    train_kwargs = dict(
        data    = str(YAML_PATH),
        epochs  = args.epochs,
        batch   = args.batch,
        imgsz   = args.imgsz,
        project = str(RUNS_DIR),
        name    = "seat",
        exist_ok= True,
        patience= 30,       # 30 에폭 동안 개선 없으면 조기 종료
        save_period=10,     # 10 에폭마다 체크포인트 저장
        plots   = True,
        verbose = True,
        amp     = False,    # CPU 학습 시 AMP 비활성화 (충돌 방지)
        workers = 0,        # Windows 멀티프로세싱 안정화
    )
    if args.device:
        train_kwargs["device"] = args.device

    try:
        results = model.train(**train_kwargs)
    except Exception as e:
        import traceback
        print(f"\n[ERROR] 학습 중 오류 발생:")
        traceback.print_exc()
        return

    best = RUNS_DIR / "seat" / "weights" / "best.pt"
    print("\n학습 완료!")
    if best.exists():
        print(f"  최종 모델: {best}")
        print(f"\n다음 단계: python seat_monitor_v2.py --calibrate")
    else:
        print("  best.pt 없음 — runs/pose/seat/weights/ 확인 필요")


if __name__ == "__main__":
    main()

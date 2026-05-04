"""
label_seats.py -- 좌석 코너 키포인트 라벨링 도구
카메라 고정 전제: 참조 프레임 1장에서 코너를 조정하면 전체 라벨 자동 생성

사용법:
  python label_seats.py            # 기본 참조 프레임(21번)으로 시작
  python label_seats.py --ref 50   # 50번 프레임을 참조로 사용

조작:
  마우스 드래그  -- 코너 위치 조정
  SPACE          -- 전체 라벨 생성 후 종료
  R              -- 기본값으로 초기화
  Q              -- 저장 없이 종료
"""

import cv2
import numpy as np
import os
import shutil
import random
import json
import argparse
from pathlib import Path

# ── 경로 ─────────────────────────────────────────────────────────────────
BASE       = Path(__file__).parent
FRAMES_DIR = BASE / "data" / "raw_frames"
DATASET_DIR = BASE / "data" / "dataset"

IMG_W, IMG_H = 960, 720

# ── 클래스 정의 (알파벳 순 → YOLO class index) ────────────────────────────
SEATS = ["N22", "N23", "N25", "N27"]   # index 0, 1, 2, 3
COLORS = {
    "N22": (34,  197,  94),   # 초록
    "N23": (239,  68,  68),   # 빨강
    "N25": (245, 158,  11),   # 주황
    "N27": ( 59, 130, 246),   # 파랑
}
KP_LABELS = ["TL", "TR", "BR", "BL"]  # 키포인트 순서 (고정)

# ── 기본 코너 (seat_monitor.py DEFAULT_POLYGONS 기반, TL→TR→BR→BL 순) ────
DEFAULT_CORNERS = {
    "N22": np.array([[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]], dtype=np.float32),
    "N23": np.array([[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]], dtype=np.float32),
    "N25": np.array([[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]], dtype=np.float32),
    "N27": np.array([[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]], dtype=np.float32),
}

# ── 상태 ─────────────────────────────────────────────────────────────────
corners  = {seat: DEFAULT_CORNERS[seat].copy() for seat in SEATS}
selected = None   # (seat_name, kp_index)
dragging = False


def to_px(norm_xy):
    return (int(norm_xy[0] * IMG_W), int(norm_xy[1] * IMG_H))


def find_nearest(mx, my, threshold=14):
    best, best_d = None, threshold
    for seat in SEATS:
        for i, pt in enumerate(corners[seat]):
            px, py = to_px(pt)
            d = ((mx - px) ** 2 + (my - py) ** 2) ** 0.5
            if d < best_d:
                best_d, best = d, (seat, i)
    return best


def draw_overlay(img):
    vis = img.copy()
    for seat in SEATS:
        color = COLORS[seat]
        pts_px = np.array([to_px(c) for c in corners[seat]], dtype=np.int32)

        # 반투명 채우기
        overlay = vis.copy()
        cv2.fillPoly(overlay, [pts_px], color)
        cv2.addWeighted(overlay, 0.18, vis, 0.82, 0, vis)

        # 테두리
        cv2.polylines(vis, [pts_px], isClosed=True, color=color, thickness=2)

        # 코너 점 + 라벨
        for i, (px, py) in enumerate(pts_px):
            dot_color = (0, 255, 0) if selected == (seat, i) else color
            cv2.circle(vis, (px, py), 8, dot_color, -1)
            cv2.circle(vis, (px, py), 8, (255, 255, 255), 1)
            cv2.putText(vis, KP_LABELS[i], (px + 6, py - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1)

        # 좌석 이름
        cx = int(pts_px[:, 0].mean())
        cy = int(pts_px[:, 1].mean())
        cv2.putText(vis, seat, (cx - 18, cy + 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
        cv2.putText(vis, seat, (cx - 18, cy + 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 1)

    cv2.putText(vis,
                "드래그: 코너 조정 | SPACE: 전체 라벨 생성 | R: 초기화 | Q: 종료",
                (10, IMG_H - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 200), 1)
    return vis


def mouse_cb(event, x, y, flags, _param):
    global selected, dragging
    if event == cv2.EVENT_LBUTTONDOWN:
        hit = find_nearest(x, y)
        if hit:
            selected, dragging = hit, True
    elif event == cv2.EVENT_MOUSEMOVE and dragging and selected:
        seat, idx = selected
        corners[seat][idx] = np.array(
            [max(0.0, min(1.0, x / IMG_W)),
             max(0.0, min(1.0, y / IMG_H))], dtype=np.float32)
    elif event == cv2.EVENT_LBUTTONUP:
        dragging = False


def make_yolo_line(class_idx, seat):
    """YOLO Pose 형식 라인 반환"""
    kps  = corners[seat]
    xs, ys = kps[:, 0], kps[:, 1]
    cx = (xs.min() + xs.max()) / 2
    cy = (ys.min() + ys.max()) / 2
    w  =  xs.max() - xs.min()
    h  =  ys.max() - ys.min()
    kp_str = " ".join(f"{kp[0]:.6f} {kp[1]:.6f} 2" for kp in kps)
    return f"{class_idx} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f} {kp_str}"


def generate_all(ref_frame_path: Path):
    frames = sorted(FRAMES_DIR.glob("*.jpg"))
    if not frames:
        print("프레임 없음!")
        return

    # 80 / 10 / 10 분할
    random.seed(42)
    idx_list = list(range(len(frames)))
    random.shuffle(idx_list)
    n = len(idx_list)
    cuts = (int(n * 0.8), int(n * 0.9))
    splits = {
        "train": [frames[i] for i in idx_list[:cuts[0]]],
        "val":   [frames[i] for i in idx_list[cuts[0]:cuts[1]]],
        "test":  [frames[i] for i in idx_list[cuts[1]:]],
    }

    label_lines   = [make_yolo_line(i, seat) for i, seat in enumerate(SEATS)]
    label_content = "\n".join(label_lines)

    for split, flist in splits.items():
        img_dir = DATASET_DIR / "images" / split
        lbl_dir = DATASET_DIR / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)
        for f in flist:
            shutil.copy(f, img_dir / f.name)
            (lbl_dir / f.with_suffix(".txt").name).write_text(label_content)

    # dataset.yaml
    yaml_text = (
        f"path: {DATASET_DIR.resolve().as_posix()}\n"
        f"train: images/train\n"
        f"val:   images/val\n"
        f"test:  images/test\n\n"
        f"kpt_shape: [4, 3]   # 4 keypoints × (x, y, visibility)\n"
        f"flip_idx: [1, 0, 3, 2]  # TL↔TR, BR↔BL (horizontal flip)\n\n"
        f"nc: {len(SEATS)}\n"
        f"names: {SEATS}\n"
    )
    (DATASET_DIR / "dataset.yaml").write_text(yaml_text)

    # reference_corners.json -- seat_monitor_v2.py 캘리브레이션용
    corners_data = {seat: corners[seat].tolist() for seat in SEATS}
    (DATASET_DIR / "reference_corners.json").write_text(
        json.dumps(corners_data, indent=2, ensure_ascii=False))

    # 참조 프레임 복사 (디버그용)
    shutil.copy(ref_frame_path, DATASET_DIR / "reference_frame.jpg")

    print(f"\n라벨 생성 완료!")
    print(f"  train {len(splits['train'])} / val {len(splits['val'])} / test {len(splits['test'])}")
    print(f"  저장 위치: {DATASET_DIR}")
    print(f"\n다음 단계: python train_pose.py")


def main():
    global corners

    parser = argparse.ArgumentParser()
    parser.add_argument("--ref", type=int, default=21,
                        help="참조 프레임 번호 (기본 21, 테이블이 잘 보이는 프레임 권장)")
    args = parser.parse_args()

    frames = sorted(FRAMES_DIR.glob("*.jpg"))
    if not frames:
        print(f"ERROR: 프레임 없음 -- {FRAMES_DIR}")
        return

    ref_idx        = min(args.ref, len(frames) - 1)
    ref_frame_path = frames[ref_idx]
    img            = cv2.resize(cv2.imread(str(ref_frame_path)), (IMG_W, IMG_H))

    print("=" * 55)
    print("  좌석 코너 라벨링 도구")
    print("=" * 55)
    print(f"  참조 프레임 : {ref_frame_path.name}")
    print(f"  전체 프레임 : {len(frames)}장")
    print()
    print("  각 좌석의 색상:")
    for seat, color in COLORS.items():
        b, g, r = color
        print(f"    {seat}: RGB({r},{g},{b})")
    print()
    print("  조작:")
    print("    마우스 드래그  -- 코너(TL/TR/BR/BL) 위치 조정")
    print("    SPACE          -- 전체 200장 라벨 생성")
    print("    R              -- 기본값으로 초기화")
    print("    Q              -- 종료")
    print("-" * 55)

    cv2.namedWindow("Seat Corner Labeling")
    cv2.setMouseCallback("Seat Corner Labeling", mouse_cb)

    while True:
        cv2.imshow("Seat Corner Labeling", draw_overlay(img))
        key = cv2.waitKey(16) & 0xFF

        if key == ord('q'):
            print("종료 (라벨 미생성)")
            break
        elif key == ord('r'):
            corners = {seat: DEFAULT_CORNERS[seat].copy() for seat in SEATS}
            print("코너 초기화 완료")
        elif key == ord(' '):
            print("\n라벨 생성 중...")
            generate_all(ref_frame_path)
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

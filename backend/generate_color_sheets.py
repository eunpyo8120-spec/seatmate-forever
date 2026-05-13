"""
generate_color_sheets.py — 좌석 캘리브레이션용 색지 시트 생성
실행: python generate_color_sheets.py
결과: color_sheets_print.png (A4 100% 비율로 인쇄)
"""

import cv2
import numpy as np

# A4 @ 150dpi: 1240 x 1754 px
SHEET_W, SHEET_H = 1240, 1754
MARGIN   = 60
PADDING  = 20
LABEL_H  = 70

SEATS = [
    ("N22", "빨강", (60,  60,  220)),   # BGR
    ("N23", "파랑", (210, 80,   50)),
    ("N25", "노랑", (30,  220, 230)),
    ("N27", "초록", (60,  180,  60)),
]

COLS, ROWS = 2, 2

cell_w = (SHEET_W - MARGIN * 2) // COLS
cell_h = (SHEET_H - MARGIN * 2) // ROWS

sheet = np.ones((SHEET_H, SHEET_W, 3), dtype=np.uint8) * 255

for idx, (seat, color_name, bgr) in enumerate(SEATS):
    col = idx % COLS
    row = idx // COLS
    x0 = MARGIN + col * cell_w
    y0 = MARGIN + row * cell_h

    # 색상 사각형 (라벨 영역 제외)
    rect_x1 = x0 + PADDING
    rect_y1 = y0 + PADDING
    rect_x2 = x0 + cell_w - PADDING
    rect_y2 = y0 + cell_h - LABEL_H - PADDING
    cv2.rectangle(sheet, (rect_x1, rect_y1), (rect_x2, rect_y2), bgr, -1)

    # 테두리
    cv2.rectangle(sheet, (rect_x1, rect_y1), (rect_x2, rect_y2), (60, 60, 60), 3)

    # 좌석 라벨 (색상 사각형 중앙)
    cx = (rect_x1 + rect_x2) // 2
    cy = (rect_y1 + rect_y2) // 2
    (tw, th), _ = cv2.getTextSize(seat, cv2.FONT_HERSHEY_SIMPLEX, 3.5, 8)
    cv2.putText(sheet, seat,
                (cx - tw // 2, cy + th // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 3.5, (255, 255, 255), 12)
    cv2.putText(sheet, seat,
                (cx - tw // 2, cy + th // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 3.5, (30, 30, 30), 4)

    # 하단 안내 텍스트
    label_y = rect_y2 + PADDING + 45
    guide = f"{seat}  ({color_name})"
    (gw, _), _ = cv2.getTextSize(guide, cv2.FONT_HERSHEY_SIMPLEX, 1.1, 2)
    cv2.putText(sheet, guide,
                (cx - gw // 2, label_y),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (40, 40, 40), 2)

# 상단 헤더
cv2.putText(sheet, "Seatmate — Color Calibration Sheets",
            (MARGIN, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (80, 80, 80), 2)

# 하단 안내
footer = "A4 100% 크기로 인쇄 | 각 종이를 잘라서 해당 좌석 책상 중앙에 놓으세요"
(fw, _), _ = cv2.getTextSize(footer, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 1)
cv2.putText(sheet, footer,
            (SHEET_W // 2 - fw // 2, SHEET_H - 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (120, 120, 120), 1)

out_path = "color_sheets_print.png"
cv2.imwrite(out_path, sheet)
print(f"저장 완료: {out_path}  ({SHEET_W}×{SHEET_H}px)")
print()
print("인쇄 방법:")
print("  - A4 용지에 100% 크기(맞춤 없음)로 컬러 인쇄")
print("  - 각 칸을 가위로 잘라서 해당 좌석 책상 중앙에 놓기")
print()
print("좌석 배치:")
for seat, color_name, _ in SEATS:
    print(f"  {seat} → {color_name} 종이")

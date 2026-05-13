"""
generate_markers.py — ArUco 마커 출력용 시트 생성
실행: python generate_markers.py
결과: aruco_markers_print.png (A4 기준 출력 권장)
"""

import cv2
import numpy as np

ARUCO_DICT = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)

SEATS = [
    ("N22", [(1, "TL"), (2, "TR"), (3, "BR"), (4, "BL")]),
    ("N23", [(5, "TL"), (6, "TR"), (7, "BR"), (8, "BL")]),
    ("N25", [(9, "TL"), (10, "TR"), (11, "BR"), (12, "BL")]),
    ("N27", [(13, "TL"), (14, "TR"), (15, "BR"), (16, "BL")]),
]

MARKER_PX = 180      # 마커 이미지 크기 (px)
BORDER    = 20       # 마커 주변 흰 여백
LABEL_H   = 40       # 라벨 텍스트 높이
CELL_W    = MARKER_PX + BORDER * 2
CELL_H    = MARKER_PX + BORDER * 2 + LABEL_H

COLS = 4             # 열 수 (TL TR BR BL)
ROWS = len(SEATS)    # 행 수 (좌석 수)

SHEET_W = COLS * CELL_W + 40
SHEET_H = ROWS * CELL_H + 80  # 상단 헤더 공간 포함

sheet = np.ones((SHEET_H, SHEET_W, 3), dtype=np.uint8) * 255

# 헤더
cv2.putText(sheet, "ArUco Markers — Seatmate (DICT_4X4_50)",
            (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
cv2.putText(sheet, "3~5cm 크기로 출력 | 각 좌석 모서리에 부착 (TL=왼쪽위, TR=오른쪽위, BR=오른쪽아래, BL=왼쪽아래)",
            (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80, 80, 80), 1)

for row_i, (seat_name, markers) in enumerate(SEATS):
    for col_i, (marker_id, corner_label) in enumerate(markers):
        x0 = col_i * CELL_W + 20
        y0 = row_i * CELL_H + 70

        # 마커 생성
        marker_img = cv2.aruco.generateImageMarker(ARUCO_DICT, marker_id, MARKER_PX)
        marker_bgr = cv2.cvtColor(marker_img, cv2.COLOR_GRAY2BGR)

        mx = x0 + BORDER
        my = y0 + BORDER
        sheet[my:my + MARKER_PX, mx:mx + MARKER_PX] = marker_bgr

        # 외곽선
        cv2.rectangle(sheet, (x0, y0), (x0 + CELL_W, y0 + CELL_H - 2), (180, 180, 180), 1)

        # 라벨 (ID + 좌석 + 코너)
        label = f"ID {marker_id}  {seat_name}-{corner_label}"
        cv2.putText(sheet, label,
                    (x0 + 5, y0 + CELL_H - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 0, 180), 1)

out_path = "aruco_markers_print.png"
cv2.imwrite(out_path, sheet)
print(f"저장 완료: {out_path}  ({SHEET_W}×{SHEET_H}px)")
print()
print("출력 방법:")
print("  - A4 용지에 100% 크기로 인쇄")
print("  - 마커 크기 약 3.3cm × 3.3cm")
print("  - 가위로 잘라서 각 좌석 모서리에 테이핑")
print()
print("마커 ID 배치:")
for seat_name, markers in SEATS:
    ids = "  ".join(f"ID{mid}({lbl})" for mid, lbl in markers)
    print(f"  {seat_name}: {ids}")
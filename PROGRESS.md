# Seatmate-Forever 진행 상황

최종 업데이트: 2026-05-13

---

## 현재 시스템 구조

```
카메라 (Tapo C200, RTSP)
  ↓
backend/seat_detector.py  ← 핵심 감지 루프 (메인)
  ├── YOLOv8n: 사람/짐 감지 (point in polygon)
  ├── calibrate_color.py: 색깔 종이로 좌석 폴리곤 캘리브레이션
  └── FastAPI: /health, /frame 엔드포인트 (포트 8000)
        ↓
  Supabase: seats, detection_logs, occupancy_conflict_logs 업데이트
        ↓
  React 프론트엔드: 실시간 좌석 현황 표시
```

감시 좌석: N22, N23, N25, N27 (4층 노상일열람실 N구역)

---

## 감지 판단 기준

| 사람 | 물건 | 판정 | DB 상태 |
|------|------|------|---------|
| ✅ | 무관 | occupied | occupied |
| ❌ | ✅ | reserved | ghost |
| ❌ | ❌ | auto_return | available |

> 확정 지연 필터: 동일 상태 3초 유지 시만 반영

---

## 완료된 작업

| 항목 | 상태 |
|------|------|
| React 프론트엔드 (좌석 예약/조회/퇴실/연장) | ✅ |
| Supabase 연동 (reservations, seats, detection_logs) | ✅ |
| FastAPI 백엔드 기본 구조 | ✅ |
| YOLOv8n 사람/짐 감지 + 확정 지연 필터 | ✅ |
| RTSP 카메라 연결 | ✅ |
| 색깔 종이 기반 캘리브레이션 (calibrate_color.py) | ✅ |
| 사람만 있을 때도 occupied 처리 | ✅ |
| NotificationsPage Supabase 실제 연동 | ✅ |

---

## 남은 작업

### 인프라 / 보안
- [ ] RLS 활성화 — `profiles`, `reservations` 테이블
- [ ] 구형 테이블 정리 — `OccupancyLogs`, `Settings`, `users` 존재 여부 확인 후 삭제

### 미래 기능
- [ ] 카카오 알림톡 API 연동

---

## 감지 정확도 개선 방향

현재 이슈: 카메라 각도/거리에 따라 폴리곤이 실제 책상과 맞지 않는 경우 발생

### 단기 (바로 시도 가능)
- [ ] **DESK_SCALE 파인튜닝** — `calibrate_color.py`에서 `+/-`로 폴리곤 크기 조정
- [ ] **HSV 범위 조정** — 조명 환경에 따라 `COLOR_RANGES` 값 수정 (S/V 하한 낮추기)
- [ ] **CONFIRM_SEC 조정** — 오탐 많으면 늘리고 반응 느리면 줄이기 (현재 3초)
- [ ] **ITEM_LABELS 확장** — 감지 못 하는 물건을 `seat_detector.py`의 `ITEM_LABELS`에 추가

### 중기 (시간 투자 필요)
- [ ] **폴리곤 마우스 조정 UI** — 캘리브레이션 후 꼭짓점 드래그 직접 조정 기능
- [ ] **사람 감지 기준점 변경** — 현재 중심점(cx, cy) → 발 위치(y2)로 변경 시 착석 판단 더 정확
- [ ] **신뢰도 임계값 조정** — 오탐 많으면 `conf < 0.3` → 0.4~0.5로 높이기

### 장기 (재학습)
- [ ] 현재 카메라 각도로 데이터 재수집 (`collect_frames.py`)
- [ ] 도서관 책상/물건 특화 YOLOv8 파인튜닝

---

## 주요 파일

| 파일 | 설명 |
|------|------|
| `backend/seat_detector.py` | 핵심 감지 루프 |
| `backend/calibrate_color.py` | 색깔 종이 기반 좌석 폴리곤 캘리브레이션 |
| `backend/generate_color_sheets.py` | 캘리브레이션용 색지 출력 파일 생성 |
| `backend/calibration.npz` | 저장된 좌석 폴리곤 |
| `backend/.env` | RTSP_URL, Supabase 키 (git 제외) |
| `src/hooks/useNotifications.ts` | 알림 Supabase 연동 훅 |
| `src/hooks/useReservations.ts` | 예약 훅 |
| `src/pages/NotificationsPage.tsx` | 알림 페이지 |

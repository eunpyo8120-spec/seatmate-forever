# 스마트 도서관 좌석 관리 시스템 — Claude Context

> 최종 업데이트: 2026-05-13

## 프로젝트 개요

한양대 학술정보관 '유령 좌석(Ghost Seat)' 문제 해결.  
카메라 + YOLOv8 AI로 실시간 좌석 점유 여부를 비접촉 감지.

**팀원**: 최원준 (birdteo) / 선병서 (Sunbyeongseo) / 전은표 (eunpyo8120-spec)

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Lovable (React) — `eunpyo8120-spec/seatmate-forever` |
| 백엔드 | 로컬 PC + FastAPI + YOLOv8 (Ultralytics) |
| DB | Supabase (PostgreSQL 17.6, `ap-northeast-2`) — Project ID: `iqmitoyfcsowzejbpxvo` |
| AI | YOLOv8n (감지) + YOLOv8s-Pose best.pt (좌석 코너, mAP50=0.995) |

---

## DB 테이블

| 테이블 | 핵심 컬럼 | 용도 |
|--------|-----------|------|
| `profiles` | id, student_id, full_name, department | 학생 프로필 (Auth 트리거 자동 생성) |
| `reservations` | user_id, seat_number, start_time, end_time, is_active | 예약 세션 |
| `seats` | seat_number, status, has_person, has_items, last_updated | 좌석 현재 상태 |
| `detection_logs` | seat_id, has_person, has_items, status, detected_at | YOLO 감지 결과 누적 |
| `occupancy_conflict_logs` | seat_id, reserved_by, conflict_type, checked_at | 예약 vs 감지 대조 |
| `seat_roi_configs` | seat_label, camera_id, points(jsonb), updated_at | 좌석 폴리곤 ROI |

`seats.status` 값: `available` / `occupied` / `ghost`

> ⚠️ `profiles` 직접 INSERT 금지 — 반드시 `auth.users.raw_user_meta_data`로 전달 (`handle_new_user` 트리거가 자동 생성)

---

## 테스트 계정

이메일: `{학번}@hanyang.ac.kr` / 비밀번호: `0000`

팀원: 전은표 `2021026953` / 선병서 `2021099698` / 최원준 `2021005632`  
더미: 김민준 `2026012341` / 이서연 `2026034872` / 박도윤 `2026051293` / 최지아 `2026067845` / 정시우 `2026083621` / 강하은 `2026091234` / 윤준서 `2026103957` / 임나은 `2026118463` / 한지호 `2026124780` / 오수아 `2026136529`

---

## 감지 알고리즘 (seat_detector.py — 현재 메인)

```
카메라 RTSP → YOLOv8n 추론 (사람/물건)
  ├─ 사람: bbox 중심점 → 좌석 폴리곤 판별
  └─ 물건: bottom-center → 좌석 폴리곤 판별 (폴리곤 밖이면 가장 가까운 좌석 배정)
       ↓
확정 지연 필터 (3초 동일 상태 유지 시만 반영)
       ↓
좌석 판정 → Supabase 업데이트 (10초마다)
```

| 책상 물건 | 사람 | 판정 | DB 상태 |
|----------|------|------|---------|
| ❌ | 무관 | auto_return | available |
| ✅ | ❌ | reserved | ghost |
| ✅ | ✅ | occupied | occupied |

> 의자 위 소지품은 점유 인정 안 함 — **책상 위 물건만** 기준 (악용 방지)

**실행**: 최초 `python seat_detector.py --calibrate` → 이후 `python seat_detector.py`  
**FastAPI**: `localhost:8000/health`, `localhost:8000/frame`  
**감시 좌석**: N22, N23, N25, N27

---

## 백엔드 파일

| 파일 | 용도 |
|------|------|
| `seat_detector.py` | **메인** — 책상 물건 기준 + 확정 지연 |
| `seat_monitor_v2.py` | 참조용 — EMA 필터 방식 (ArUco 작업 대상) |
| `seat_monitor.py` | 구형 — 정적 폴리곤 |
| `detect_live.py` | Supabase 없이 RTSP+YOLO 테스트 |
| `collect_frames.py` / `label_seats.py` / `train_pose.py` | 모델 학습 도구 |
| `runs/pose/seat/weights/best.pt` | 파인튜닝 모델 (git 제외) |
| `.env` | SUPABASE_KEY, RTSP_URL (git 제외) |

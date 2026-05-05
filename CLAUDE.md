# 스마트 도서관 좌석 관리 시스템 — Claude Context

> 이 파일은 Claude와의 대화 내용을 기반으로 생성된 프로젝트 컨텍스트 문서입니다.
> 새 대화에서 이 파일을 첨부하면 Claude가 프로젝트 전체 맥락을 즉시 파악합니다.
> 최종 업데이트: 2026-05-05

---

## 프로젝트 개요

**프로젝트명**: 스마트 도서관 좌석 관리 시스템 (Ghost Seat 해결)
**팀원**:
- 2021005632 최원준 (GitHub: birdteo)
- 2021099698 선병서 (GitHub: Sunbyeongseo)
- 2021026953 전은표 본인 (GitHub: eunpyo8120-spec)

**목적**: 한양대학교 학술정보관의 '유령 좌석(Ghost Seat)' 문제 해결
- 키오스크 배정과 실제 착석 불일치로 인한 학생 불만
- 카메라 + YOLOv8 AI로 실시간 좌석 점유 여부를 비접촉 감지

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Lovable (React 기반) — `eunpyo8120-spec/seatmate-forever` |
| 백엔드 | 로컬 PC + FastAPI(내장) + YOLOv8 (Ultralytics) — EC2 미사용 |
| 데이터베이스 | Supabase (PostgreSQL 17.6, 서울 리전 `ap-northeast-2`) |
| 알림 | 카카오 알림톡 API (미구현) |
| AI 모델 | YOLOv8 — 사람/물건 감지, ROI 좌석별 폴리곤 매핑 |

---

## Supabase 프로젝트 정보

- **Project ID**: `iqmitoyfcsowzejbpxvo`
- **Host**: `db.iqmitoyfcsowzejbpxvo.supabase.co`
- **Region**: `ap-northeast-2` (서울)
- **PostgreSQL 버전**: 17.6

---

## 현재 DB 테이블 (신형 스키마)

| 테이블 | 스키마 핵심 컬럼 | 용도 |
|--------|-----------------|------|
| `profiles` | id, student_id, full_name, department | 학생 프로필 (Auth 트리거로 자동 생성) |
| `reservations` | id, user_id, seat_number, start_time, end_time, is_active | 좌석 예약 세션 |
| `seats` | id, seat_number, status, has_person, has_items, last_updated | 좌석 현재 상태 |
| `detection_logs` | id, seat_id, has_person, has_items, status, detected_at | YOLO 감지 결과 10초마다 누적 |
| `occupancy_conflict_logs` | id, seat_id, reserved_by, detected_person, detected_items, conflict_type, checked_at | 예약 vs 실제 감지 대조 |
| `seat_roi_configs` | id, seat_label, camera_id, points(jsonb), updated_at | 좌석별 폴리곤 ROI 꼭짓점 |

---

## 주요 테이블 스키마

### `seats` (핵심)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK) | 좌석 ID |
| `seat_number` | text | 좌석 번호 |
| `status` | text | available / occupied / ghost |
| `has_person` | boolean | 사람 감지 여부 |
| `has_items` | boolean | 물건 감지 여부 |
| `last_updated` | timestamptz | 마지막 업데이트 시각 |

### `profiles`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid (PK, FK → auth.users.id) | Auth UID |
| `student_id` | text (unique) | 학번 |
| `full_name` | text | 이름 |
| `department` | text | 학과/트랙 |

> ⚠️ 구형 테이블 (`OccupancyLogs`, `Settings`, `users`) 존재 여부 미확인 — 현재는 `reservations`, `detection_logs`, `occupancy_conflict_logs` 사용

---

## 트리거

### `handle_new_user`
`auth.users`에 신규 유저 삽입 시 자동으로 `profiles`를 생성하는 트리거.

```sql
INSERT INTO auth.users (..., raw_user_meta_data) VALUES (
  ...,
  '{"student_id":"2021026953","full_name":"전은표","department":"전자공학부"}'
);
-- → profiles에 자동 삽입됨
```

> ⚠️ `profiles`에 직접 INSERT하면 안 됨. 반드시 `raw_user_meta_data`를 통해 전달.

---

## 테스트 계정

이메일 형식: `{학번}@hanyang.ac.kr` / 비밀번호: `0000`

| 학번 | 이름 | 학과 |
|------|------|------|
| 2021026953 | 전은표 | 전자공학부 |
| 2021099698 | 선병서 | 전자공학부 |
| 2021005632 | 최원준 | 전자공학부 |
| 2026012341 | 김민준 | 컴퓨터공학과 |
| 2026034872 | 이서연 | 소프트웨어학과 |
| 2026051293 | 박도윤 | 전자공학과 |
| 2026067845 | 최지아 | 기계공학과 |
| 2026083621 | 정시우 | 산업공학과 |
| 2026091234 | 강하은 | 경영학과 |
| 2026103957 | 윤준서 | 수학과 |
| 2026118463 | 임나은 | 물리학과 |
| 2026124780 | 한지호 | 화학과 |
| 2026136529 | 오수아 | 건축학과 |

---

## 시스템 알고리즘 흐름

### seat_monitor.py (구형 — 정적 폴리곤)
```
카메라(Tapo C200) RTSP 스트림
    ↓
seat_monitor.py 로컬 실행
    ↓
YOLOv8n 모델 추론 (사람 / 물건 감지)
    ↓
수동 등록 ROI 폴리곤 매핑 (cv2.pointPolygonTest, bbox 중심점)
    ↓
10초마다 Supabase 업데이트
    ↓ (detection_logs INSERT / seats UPDATE)
Lovable 프론트 Realtime 반영
```

### seat_detector.py (최신 메인 — 책상 물건 기준 + 확정 지연)
```
[최초 1회] python seat_detector.py --calibrate
    ↓
YOLOv8s-Pose(best.pt)로 좌석 4개 코너(TL/TR/BR/BL) 자동 감지
    ↓
calibration.npz 저장 (좌석별 픽셀 좌표 폴리곤)

[이후 매 실행] python seat_detector.py
    ↓
calibration.npz 로드
    ↓
YOLOv8n 추론 (사람 / 물건 감지)
    ↓
사람: 중심점 → 좌석 폴리곤 판별
물건(책상 한정): bottom-center → 좌석 폴리곤 판별
  └→ 폴리곤 외부면: 2축 판별(좌/우+앞/뒤)로 가장 가까운 좌석 배정
    ↓
확정 지연 필터 (CONFIRM_SEC=3초) → 동일 상태 3초 유지 시만 DB 반영
    ↓
좌석 상태 판단:
  책상 물건 없음         → auto_return  (사람 유무 무관 — 악용 방지)
  책상 물건 있음 + 사람  → occupied
  책상 물건 있음 + 사람 없음 → reserved
    ↓
10초마다 Supabase 업데이트
    ↓ (detection_logs INSERT / seats UPDATE)
Lovable 프론트 Realtime 반영
```

### seat_monitor_v2.py (중간 버전 참조용)
```
seat_detector.py 이전 버전. EMA 필터 + bottom-center 사람 감지 방식.
현재는 seat_detector.py를 사용하며, v2는 비교/참조용으로만 유지.
```

---

## 좌석 상태 판별 로직 (seat_detector.py 기준)

> 악용 방지 원칙: 의자 위 소지품은 점유 인정 안 함 — **책상 위 물건만** 기준

| 책상 물건 | 사람 | 판정 | DB 상태 | 처리 |
|----------|------|------|---------|------|
| ❌ | 무관 | **auto_return** | available | 즉시 자동반납 |
| ✅ | ❌ | **reserved** | ghost | 잠시 자리 비움 (물건으로 자리 맡음) |
| ✅ | ✅ | **occupied** | occupied | 정상 사용 중 |

> 3초 확정 지연: 순간 오감지로 인한 잦은 DB 업데이트 방지

---

## AdminCalibratePage 폴리곤 편집기 사용법

- **클릭**: 좌석 선택
- **꼭짓점 드래그**: 위치 조정
- **엣지 더블클릭**: 꼭짓점 추가
- **꼭짓점 우클릭**: 꼭짓점 삭제 (최소 3개 유지)
- 저장 → Supabase `seat_roi_configs` 테이블에 반영
- `seat_monitor.py` 재시작 시 자동으로 폴리곤 로드

---

---

## 개발 환경

- **카메라 서버**: 로컬 PC — 학교 네트워크(카메라와 같은 망)에서만 RTSP 접속 가능
- **실행 방식**: `python seat_monitor.py` 로컬 실행 → Supabase에 직접 전송
- **IDE**: VS Code
- **AI 모델**: YOLOv8 (Ultralytics)
- **내장 HTTP 서버**: seat_monitor.py가 FastAPI 스레드로 localhost:8000 노출
  - `GET /health` — 헬스체크
  - `GET /frame` — 현재 카메라 프레임 JPEG (AdminCalibratePage 캘리브레이션용)
- **ROI 좌석**: N21, N22, N23, N25, N27 (집중 열람실)

### 백엔드 파일 현황 (seatmate-forever/backend/)

| 파일 | 상태 | 비고 |
|------|------|------|
| `seat_monitor.py` | ✅ 유지 | 구형 모니터링 (정적 폴리곤 방식) |
| `seat_monitor_v2.py` | ✅ 완료 | 중간 버전 (YOLOv8-Pose + EMA 필터) |
| `seat_detector.py` | ✅ 완료 | **최신 메인** (책상 물건 기준 판단 + 확정 지연 필터) |
| `collect_frames.py` | ✅ 완료 | RTSP 학습용 프레임 수집 도구 |
| `label_seats.py` | ✅ 완료 | 좌석 코너 키포인트 라벨링 GUI |
| `train_pose.py` | ✅ 완료 | YOLOv8s-Pose 파인튜닝 스크립트 |
| `detect_live.py` | ✅ 유지 | RTSP+YOLO 테스트용 (Supabase 없이) |
| `init_seats.sql` | ✅ 유지 | DB 초기 데이터 참조용 |
| `.env` | ✅ 사용 | 환경변수 (SUPABASE_KEY, RTSP_URL) — git 제외 |
| `requirements.txt` | ✅ 사용 | 패키지 목록 |
| `yolov8n.pt` | ✅ 사용 | YOLO 감지 모델 — git 제외 |
| `runs/pose/seat/weights/best.pt` | ✅ 완료 | 파인튜닝 완료 모델 (mAP50=0.995) — git 제외 |

> **모델 학습 결과** (2026-05-05, CPU 학습 2.37시간):
> - 베이스: `yolov8s-pose.pt` / 파인튜닝: 50 에폭, batch=4, imgsz=640
> - Box mAP50: **0.995** / Pose mAP50-95: **0.995**
> - 4클래스 (N22/N23/N25/N27) × 키포인트 4개 (TL/TR/BR/BL)

---

## 남은 작업

### 백엔드 AI 파이프라인
- [x] YOLOv8-Pose 학습 데이터 수집 (`collect_frames.py`, 200프레임)
- [x] 좌석 코너 키포인트 라벨링 (`label_seats.py`, N22/N23/N25/N27 × TL/TR/BR/BL)
- [x] YOLOv8s-Pose 파인튜닝 (`train_pose.py`, mAP50=0.995)
- [x] `seat_monitor_v2.py` 구현 (자동 캘리브레이션 + EMA 필터)
- [x] `seat_detector.py` 구현 (책상 물건 기준 판단 + 3초 확정 지연 + 가장 가까운 좌석 배정)
- [ ] 실제 카메라(Tapo C200)로 `seat_detector.py` 테스트 (`--calibrate` → 일반 실행)

### 프론트엔드
- [ ] NotificationsPage — Supabase 실제 연동 (현재 Zustand 더미 데이터)

### 인프라 / 보안
- [ ] RLS 활성화 — profiles, reservations 테이블
- [ ] OccupancyLogs, Settings, users 테이블 현황 확인 (구형 스키마 여부)

### 미래 기능
- [ ] 카카오 알림톡 API 연동

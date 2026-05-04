# 스마트 도서관 좌석 관리 시스템 — Claude Context

> 이 파일은 Claude와의 대화 내용을 기반으로 생성된 프로젝트 컨텍스트 문서입니다.
> 새 대화에서 이 파일을 첨부하면 Claude가 프로젝트 전체 맥락을 즉시 파악합니다.

---

## 프로젝트 개요

**프로젝트명**: 스마트 도서관 좌석 관리 시스템 (Ghost Seat 해결)
**팀원**:
- 2021005632 최원준
- 2021099698 선병서
- 2021026953 전은표 (본인)

**목적**: 한양대학교 학술정보관의 '유령 좌석(Ghost Seat)' 문제 해결
- 키오스크 배정과 실제 착석 불일치로 인한 학생 불만
- 카메라 + YOLOv8 AI로 실시간 좌석 점유 여부를 비접촉 감지

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Lovable (React 기반) |
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

## ⚡ 최근 작업 진행 상황 (2026-04-27 기준)

> 세션이 끊겼다가 재시작되면 이 섹션을 먼저 읽을 것

### 완료된 작업

| 파일 | 상태 | 내용 |
|------|------|------|
| `src/App.tsx` | ✅ 완료 | `ReservationSync` 컴포넌트 추가 — 보호된 라우트에서 예약 실시간 동기화 |
| `src/hooks/useReservations.ts` | ✅ 완료 | `reservations` 테이블 기반 CRUD + Realtime 구독 |
| `src/hooks/useAuth.ts` | ✅ 완료 | Supabase Auth + `profiles.display_name` 지원 |
| `src/pages/AdminCalibratePage.tsx` | ✅ 완료 | 원형 ROI → **폴리곤 꼭짓점 드래그** 방식으로 전면 교체, `as any` 제거 |
| `backend/seat_monitor.py` | ✅ 완료 | 최근접 중심점 방식 → **폴리곤 ROI + cv2.pointPolygonTest** 방식으로 교체 |
| Supabase `seat_roi_configs` 테이블 | ✅ 완료 | 원형 스키마(center_x/y/radius) → **폴리곤 스키마(points jsonb)** 로 수정 |
| Supabase 마이그레이션 파일 | ✅ 완료 | `detection_logs`, `occupancy_conflict_logs`, `seat_roi_configs`(폴리곤) |
| `src/integrations/supabase/types.ts` | ✅ 완료 | `seats`, `detection_logs`, `occupancy_conflict_logs`, `seat_roi_configs` 타입 추가 |

> ⚠️ **버그 이력**: `seat_roi_configs` 마이그레이션이 크래시로 인해 구형(원형) 스키마로 생성됐다가 수동 수정됨.
> 세션 B→C 크래시 직후 생성된 마이그레이션 파일이 원인. 2026-04-26 폴리곤 방식으로 재수정 완료.

### 현재 DB 테이블 전체 목록 (Supabase)

| 테이블 | 스키마 핵심 컬럼 | 용도 |
|--------|-----------------|------|
| `profiles` | id, student_id, full_name, department | 학생 프로필 (Auth 트리거로 자동 생성) |
| `reservations` | id, user_id, seat_number, start_time, end_time, is_active | 좌석 예약 세션 |
| `seats` | id, seat_number, status, has_person, has_items, last_updated | 좌석 현재 상태 |
| `detection_logs` | id, seat_id, has_person, has_items, status, detected_at | YOLO 감지 결과 10초마다 누적 |
| `occupancy_conflict_logs` | id, seat_id, reserved_by, detected_person, detected_items, conflict_type, checked_at | 예약 vs 실제 감지 대조 |
| `seat_roi_configs` | id, seat_label, camera_id, **points(jsonb)**, updated_at | 좌석별 폴리곤 ROI 꼭짓점 |

### AdminCalibratePage 폴리곤 편집기 사용법
- **클릭**: 좌석 선택
- **꼭짓점 드래그**: 위치 조정
- **엣지 더블클릭**: 꼭짓점 추가
- **꼭짓점 우클릭**: 꼭짓점 삭제 (최소 3개 유지)
- 저장 → Supabase `seat_roi_configs` 테이블에 반영
- `seat_monitor.py` 재시작 시 자동으로 폴리곤 로드

### seat_monitor.py 동작 흐름
1. 시작 시 Supabase `seat_roi_configs`에서 폴리곤 로드 (없으면 기본 5분할 사용)
2. FastAPI 스레드 (localhost:8000) 시작 — AdminCalibratePage가 `/frame`으로 카메라 피드 수신
3. RTSP 스트림 → YOLOv8 추론
4. 바운딩박스 중심점 → `cv2.pointPolygonTest`로 좌석 판별
5. 10초마다: `detection_logs` + `occupancy_conflict_logs` INSERT, `seats` UPDATE

### 기본 폴리곤 구역 (normalized 0~1, AdminCalibratePage 미저장 시 사용)
- N23 (좌상단): `[0,0]→[0.5,0]→[0.5,0.5]→[0,0.5]`
- N27 (우상단): `[0.5,0]→[1,0]→[1,0.5]→[0.5,0.5]`
- N22 (좌중단): `[0,0.5]→[0.5,0.5]→[0.5,0.75]→[0,0.75]`
- N25 (우중단): `[0.5,0.5]→[1,0.5]→[1,0.75]→[0.5,0.75]`
- N21 (하단): `[0,0.75]→[1,0.75]→[1,1]→[0,1]`

### 남은 작업 (다음에 이어서)
- [ ] 알림(NotificationsPage) — 현재 Zustand store 더미 데이터, Supabase 실제 연동 필요
- [ ] EC2 불필요 파일 삭제: `main.py`, `app_detect.py`, `local_client.py`, `check_now.py`
- [ ] 실제 카메라(Tapo C200)로 전체 파이프라인 테스트

---

## 데이터베이스 스키마 (public)

### `seats`
좌석 상태 정보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK) | 좌석 ID |
| `seat_number` | text | 좌석 번호 |
| `status` | text | 상태 (available / occupied / ghost 등) |
| `has_person` | boolean | 사람 감지 여부 |
| `has_items` | boolean | 물건 감지 여부 |
| `last_updated` | timestamptz | 마지막 업데이트 시각 |

### `OccupancyLogs`
좌석 이벤트 로그

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid (PK) | 로그 ID |
| `seat_id` | bigint (FK → seats.id) | 좌석 참조 |
| `event_type` | text | 이벤트 종류 |
| `created_at` | timestamptz | 이벤트 발생 시각 |
| `user_id` | uuid (FK → profiles.id) | 담당 사용자 **(추가 권장)** |

### `Settings`
시스템 설정값 (key-value)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `key` | text (PK) | 설정 키 |
| `value` | integer | 설정값 |

### `users`
좌석 예약/사용 세션

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK) | 세션 ID |
| `user_id` | uuid (FK → profiles.id) | 사용자 참조 ✅ FK 연결 완료 |
| `seat_id` | bigint (FK → seats.id) | 좌석 참조 |
| `start_time` | timestamptz | 사용 시작 |
| `end_time` | timestamptz | 사용 종료 |
| `is_active` | boolean | 활성 여부 |

### `profiles`
학생 프로필 (Supabase Auth 연동)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid (PK, FK → auth.users.id) | Auth UID |
| `student_id` | text (unique) | 학번 |
| `full_name` | text | 이름 |
| `department` | text | 학과/트랙 |
| `created_at` | timestamptz | 가입 시각 |

---

## 트리거

### `handle_new_user`
`auth.users`에 신규 유저 삽입 시 자동으로 `profiles`를 생성하는 트리거.

```sql
-- 동작 방식
INSERT INTO auth.users (..., raw_user_meta_data) VALUES (
  ...,
  '{"student_id":"2021026953","full_name":"전은표","department":"전자공학부"}'
);
-- → profiles에 자동 삽입됨
```

> ⚠️ `profiles`에 직접 INSERT하면 안 됨. 반드시 `raw_user_meta_data`를 통해 전달.

---

## 마이그레이션 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-24 | `users.user_id → profiles.id` FK 제약 추가 (`users_user_id_fkey`) |

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

```
카메라 웹캠 촬영
    ↓
이미지 업로드
    ↓
AWS EC2 서버로 전송
    ↓
YOLOv8 모델 추론 (사람 / 물건 감지)
    ↓
ROI 폴리곤 매핑 (좌석별 구역 분리)
    ↓
상태머신 / 타이머 (시간 측정)
    ↓
FastAPI → JSON 출력
    ↓
Supabase DB 업데이트 (seats, OccupancyLogs)
    ↓
Lovable 프론트 Realtime 반영
```

---

## 좌석 상태 판별 로직

| 사람 | 물건 | 판정 | 처리 |
|------|------|------|------|
| ❌ | ❌ | 빈 좌석 (미반납) | 반납 처리 + 경고 부과 |
| ❌ | ✅ | 물건만 있음 | 4시간 미만 → 자율위원회 관리 / 4시간 이상 → 분실물 처리 + 알림 |
| ✅ | ❌ | 사람만 있음 | 예약 마감 10분 전 알림 |
| ✅ | ✅ | 정상 사용 중 | 유지 |

---

## 컴포넌트 연결 방법

### AWS EC2 ↔ Supabase

```python
from supabase import create_client

supabase = create_client(
    "https://iqmitoyfcsowzejbpxvo.supabase.co",
    "SERVICE_ROLE_KEY"  # Settings > API > service_role
)

# 좌석 상태 업데이트
supabase.table("seats").update({
    "has_person": True,
    "has_items": False,
    "status": "occupied",
    "last_updated": "now()"
}).eq("id", seat_id).execute()

# 이벤트 로그 기록
supabase.table("OccupancyLogs").insert({
    "seat_id": seat_id,
    "event_type": "person_detected"
}).execute()
```

### Lovable ↔ Supabase

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://iqmitoyfcsowzejbpxvo.supabase.co',
  'ANON_KEY'  // Settings > API > anon key
)

// 좌석 실시간 구독
supabase
  .channel('seats')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'seats'
  }, (payload) => {
    updateSeatUI(payload.new)
  })
  .subscribe()
```

### 계정 생성 방법 (auth.users 직접 삽입)

```sql
INSERT INTO auth.users (
  id, email, encrypted_password,
  confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(),
  '학번@hanyang.ac.kr',
  crypt('비밀번호', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"student_id":"학번","full_name":"이름","department":"학과"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
);
-- handle_new_user 트리거가 profiles 자동 생성
```

---

## 미완료 / 추가 권장 사항

- [ ] `OccupancyLogs`에 `user_id` 컬럼 추가 (누가 한 행동인지 추적)
- [ ] RLS(Row Level Security) 활성화 — 특히 `profiles`, `users` 테이블
- [ ] `users` 테이블 이름 → `seat_sessions`으로 변경 권장 (auth.users와 혼동 방지)
- [ ] `Settings.value` 타입 → `text` 또는 `jsonb`로 확장 권장
- [ ] EC2 탄력적 IP 고정 + Supabase Allowed IPs 등록
- [ ] FastAPI CORS 설정 — Lovable 도메인 허용
- [ ] 카카오 알림톡 API 연동

---

## 개발 환경

- **카메라 서버**: 로컬 PC (EC2 사용 안 함 — 같은 네트워크에서 직접 RTSP 접속)
- **실행 방식**: `python seat_monitor.py` 로컬에서 실행 → Supabase에 직접 전송
- **IDE**: VS Code
- **AI 모델**: YOLOv8 (Ultralytics)
- **내장 HTTP 서버**: seat_monitor.py가 FastAPI 스레드로 localhost:8000 노출
  - `GET /health` — 헬스체크
  - `GET /frame` — 현재 카메라 프레임 JPEG (AdminCalibratePage 캘리브레이션용)
- **ROI 좌석**: N21, N22, N23, N25, N27 (집중 열람실)

### 백엔드 파일 현황 (seatmate-forever/backend/) — 2026-04-27 이동 완료

| 파일 | 상태 | 비고 |
|------|------|------|
| `seat_monitor.py` | ✅ 사용 | 메인 모니터링 스크립트 |
| `detect_live.py` | ✅ 유지 | RTSP+YOLO 테스트용 (Supabase 없이) |
| `init_seats.sql` | ✅ 유지 | DB 초기 데이터 참조용 |
| `.env` | ✅ 사용 | 환경변수 |
| `requirements.txt` | ✅ 사용 | 패키지 목록 |
| `yolov8n.pt` | ✅ 사용 | YOLO 모델 가중치 |
| `main.py` | ❌ 불필요 | EC2에 이미지 업로드받는 서버 — 로컬 전환으로 폐기 |
| `app_detect.py` | ❌ 불필요 | EC2 YOLO 엔드포인트 — 폐기 |
| `local_client.py` | ❌ 불필요 | EC2로 프레임 전송하던 클라이언트 — 폐기 |
| `check_now.py` | ❌ 불필요 | EC2 일회성 테스트 — 폐기 |

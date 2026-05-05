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
| 백엔드 | AWS EC2 + FastAPI + YOLOv8 (Ultralytics) |
| 데이터베이스 | Supabase (PostgreSQL 17.6, 서울 리전 `ap-northeast-2`) |
| 알림 | 카카오 알림톡 API |
| AI 모델 | YOLOv8 — 사람/물건 감지, ROI 좌석별 폴리곤 매핑 |

---

## Supabase 프로젝트 정보

- **Project ID**: `iqmitoyfcsowzejbpxvo`
- **Host**: `db.iqmitoyfcsowzejbpxvo.supabase.co`
- **Region**: `ap-northeast-2` (서울)
- **PostgreSQL 버전**: 17.6

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
| 2026-04-27 | `detection_logs`, `occupancy_conflict_logs`, `seat_roi_configs` 테이블 추가 (좌석 감지 시스템 연동) |

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
- [ ] `seat_roi_configs` 테이블 Supabase에 생성 (없으면 DEFAULT_POLYGONS 사용됨)
- [ ] AdminCalibratePage에서 실제 카메라 화면 보며 폴리곤 캘리브레이션 1회 실행 필요
- [ ] N23, N25, N21 좌석 DEFAULT_POLYGONS 좌표 검증 필요 (현재 단순 격자 분할, 실제 화각과 다를 수 있음)

---

## 개발 환경

- **클라우드**: AWS EC2 (서울 리전, t3.micro)
- **OS**: Linux Ubuntu
- **IDE**: VS Code
- **AI 모델**: YOLOv8 (Ultralytics)
- **서버 프레임워크**: FastAPI (uvicorn)
- **ROI 좌석 예시**: N21, N22, N23, N25, N27 (집중 열람실)

---

## 로컬 좌석 감지 시스템 (2026-04-27 추가 구현)

### 개요

EC2 서버 없이 **로컬 Windows PC**에서 직접 RTSP 카메라 → YOLOv8 → Supabase 파이프라인을 실행하는 방식으로 구현됨.

- **파일 위치**: `C:\Users\samsung\project_claude\seatmate-forever\backend\seat_monitor.py`
- **실행 방법**: `python seat_monitor.py` (backend 폴더에서)
- **카메라**: Tapo RTSP 카메라 (`rtsp://tapo1234:123456788@10.17.239.85/stream1`)
- **감지 좌석**: N21, N22, N23, N25, N27 (집중 열람실 5석)

### 아키텍처 변경 이력

| 시기 | 방식 | 상태 |
|------|------|------|
| 초기 | AWS EC2 FastAPI 서버에 프레임 전송 | 동작 확인됨 |
| 중간 | 폴리곤 ROI (코드 내 하드코딩 좌표) | 카메라 화각 불일치 문제 발생 |
| 중간 | nearest-neighbor 방식 (거리 기반 좌석 배정) | 동작했으나 정확도 한계 |
| **현재** | **폴리곤 ROI + Supabase 저장 + FastAPI 프레임 서버** | **현재 코드** |

### 현재 seat_monitor.py 핵심 구조

```
실행 시:
  1. FastAPI 서버 백그라운드 시작 (port 8000)
     → /frame 엔드포인트: 현재 카메라 프레임 JPEG 제공
     → AdminCalibratePage에서 이 화면 보며 폴리곤 그릴 수 있음
  2. Supabase seat_roi_configs 테이블에서 폴리곤 로드
     → 없으면 DEFAULT_POLYGONS(단순 격자 분할) 사용
  3. RTSP 연결 후 루프:
     → 프레임 캡처 → 960x720 리사이즈
     → YOLOv8 추론 (person / 물건류)
     → pointPolygonTest로 좌석 판별
     → 10초마다 Supabase 저장
```

### 추가된 Supabase 테이블

#### `detection_logs`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `seat_id` | text | 좌석 번호 (N21~N27) |
| `has_person` | boolean | 사람 감지 여부 |
| `has_items` | boolean | 물건 감지 여부 |
| `status` | text | occupied / person_only / items_only / empty |
| `detected_at` | timestamptz | 감지 시각 |

#### `occupancy_conflict_logs`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `seat_id` | text | 좌석 번호 |
| `reserved_by` | text | 예약자 학번 (없으면 null) |
| `detected_person` | boolean | 사람 감지 여부 |
| `detected_items` | boolean | 물건 감지 여부 |
| `conflict_type` | text | 정상 / 유령좌석_물건 / 유령좌석_비어있음 / 무단점유 / 무단물건 / 빈좌석 |
| `checked_at` | timestamptz | 확인 시각 |

#### `seat_roi_configs`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `seat_label` | text | 좌석 번호 (N21~N27) |
| `camera_id` | text | 카메라 ID (현재 `"main"` 고정) |
| `points` | jsonb | 폴리곤 꼭짓점 배열 (정규화 좌표 [[x,y], ...], 0~1 범위) |

> ⚠️ 이 테이블이 Supabase에 없으면 코드 내 DEFAULT_POLYGONS(격자 분할)로 대체됨.
> AdminCalibratePage에서 캘리브레이션 완료 시 이 테이블에 자동 저장됨.

### DEFAULT_POLYGONS (현재 기본값 — 단순 격자)

```
N23 = 좌상단 사분면  (0.0~0.5, 0.0~0.5)
N27 = 우상단 사분면  (0.5~1.0, 0.0~0.5)
N22 = 좌중간         (0.0~0.5, 0.5~0.75)
N25 = 우중간         (0.5~1.0, 0.5~0.75)
N21 = 하단 전체      (0.0~1.0, 0.75~1.0)
```

> ⚠️ 실제 카메라 화각에서 N23, N27, N22 위치 확인됨 (이전 세션에서 사용자가 직접 앉아서 확인).
> 실제 좌표는 AdminCalibratePage로 캘리브레이션해서 Supabase에 저장해야 정확해짐.

### backend/ 폴더 파일 목록

| 파일 | 역할 |
|------|------|
| `seat_monitor.py` | **메인 감지 스크립트** (현재 버전) |
| `detect_live.py` | 로컬 YOLOv8 화면 표시 (디버깅용) |
| `check_now.py` | 현재 인원 1회 확인 |
| `local_client.py` | EC2로 프레임 전송 (구버전 방식) |
| `app_detect.py` | FastAPI 감지 서버 (EC2용) |
| `main.py` | EC2 메인 서버 |
| `yolov8n.pt` | YOLOv8 nano 모델 |
| `.env` | `SUPABASE_URL`, `SUPABASE_KEY`, `RTSP_URL` |
| `requirements.txt` | `supabase<2.10.0` 명시 필요 (pyiceberg 의존성 이슈) |

### 알려진 이슈 및 해결 방법

| 이슈 | 원인 | 해결 |
|------|------|------|
| `pip install` 실패 | `pyiceberg`가 C++ 컴파일러 요구 | `requirements.txt`에 `supabase<2.10.0` 명시 |
| 프레임 메모리 오류 | 1920×1080 버퍼 과다 | `cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)` |
| 로그 시간 오류 | 로컬 시스템 시간대 불일치 | `datetime.now(timezone.utc)` 사용 |
| 좌석 폴리곤 불일치 | 하드코딩 좌표가 실제 화각과 다름 | AdminCalibratePage 캘리브레이션 필요 |

---

## Claude 구현 시작 전 체크리스트

> 이 파일을 읽은 Claude는 구현을 시작하기 전에 반드시 아래 순서를 따른다.

### 1단계: 현재 구현 상태 파악

아래 항목을 직접 확인한다 (파일/폴더 존재 여부 체크):

**Supabase**
- [ ] `seats` 테이블 데이터 존재 여부 (좌석이 몇 개 등록돼 있는지)
- [ ] `OccupancyLogs` 테이블에 `user_id` 컬럼 추가 여부
- [ ] RLS(Row Level Security) 활성화 여부
- [ ] `handle_new_user` 트리거 정상 동작 여부

**백엔드 (FastAPI)**
- [ ] EC2 서버 코드 파일 존재 여부 (`main.py` 또는 `app.py` 등)
- [ ] YOLOv8 모델 파일 존재 여부 (`best.pt` 등)
- [ ] ROI 폴리곤 설정 파일 존재 여부
- [ ] `.env` 파일에 Supabase 키 설정 여부

**프론트엔드 (Lovable)**
- [ ] Supabase 클라이언트 연결 코드 존재 여부
- [ ] 실시간(Realtime) 구독 코드 존재 여부
- [ ] 좌석 지도 UI 컴포넌트 존재 여부

### 2단계: 구현 시작 전 사용자에게 반드시 물어볼 것

확인되지 않은 항목이 있으면 AskUserQuestion 도구로 아래 질문들을 한다.
**한 번에 모아서 물어보고, 답변 받은 뒤 구현을 시작한다.**

```
[필수 질문 목록]

Q1. 현재 어디까지 구현되어 있나요?
    옵션: "Supabase DB만 구성됨", "FastAPI 서버 기본 구조 있음",
          "Lovable 프론트 연결됨", "YOLOv8 모델 테스트까지 완료",
          "처음 시작"

Q2. 지금 가장 먼저 구현하고 싶은 부분이 어디인가요?
    옵션: "FastAPI + YOLOv8 좌석 감지 서버",
          "Lovable 프론트 좌석 UI",
          "Supabase DB 연동 (CRUD)",
          "카카오 알림톡 연동",
          "전체 흐름 테스트"

Q3. EC2 서버에 이미 접속 가능한 상태인가요?
    옵션: "접속 가능 (IP 있음)", "아직 세팅 안 됨", "로컬에서 먼저 테스트 예정"

Q4. 카메라(웹캠) 환경은 준비되어 있나요?
    옵션: "실제 카메라 연결됨", "테스트용 영상/이미지로 대체 예정", "아직 없음"

Q5. Supabase SERVICE_ROLE_KEY와 ANON_KEY는 갖고 계신가요?
    옵션: "있음 (직접 입력할게요)", "Supabase 대시보드에서 확인 필요", "모르겠음"
```

### 3단계: 구현 순서 제안 (답변 기반)

답변을 받으면 아래 기본 순서를 바탕으로 현재 상황에 맞게 조정하여 제안한다:

```
[권장 구현 순서]

Phase 1 — 기반 (DB + 서버 뼈대)
  1. Supabase 테이블 최종 점검 및 보완 (RLS, user_id 컬럼 등)
  2. FastAPI 프로젝트 초기화 (폴더 구조, requirements.txt)
  3. Supabase ↔ FastAPI 연결 테스트

Phase 2 — AI 핵심 (YOLOv8 감지)
  4. YOLOv8 기본 감지 코드 작성 (사람/물건 클래스)
  5. ROI 폴리곤 설정 (좌석별 구역 지정)
  6. 감지 결과 → 상태머신 로직 (사람/물건 조합 판별)

Phase 3 — 연동 (DB 업데이트)
  7. 감지 결과 → Supabase `seats` 업데이트
  8. 이벤트 → `OccupancyLogs` 기록
  9. Ghost Seat 타이머 로직

Phase 4 — 프론트 (Lovable UI)
  10. Supabase Realtime 구독
  11. 좌석 지도 UI (상태별 색상 표시)
  12. 관리자 대시보드

Phase 5 — 알림 + 마무리
  13. 카카오 알림톡 API 연동
  14. 전체 흐름 E2E 테스트
  15. EC2 배포 및 운영 설정
```

### 4단계: 구현 규칙

- **API 키는 반드시 `.env` 파일에 보관** — 코드에 직접 입력 금지
- **코드 설명보다 결과물 우선** — 작동하는 코드를 바로 제공
- **파일 단위로 완성** — 반쪽짜리 코드 금지, 실행 가능한 상태로 제공
- **테스트 방법도 함께** — 코드 작성 후 "이렇게 테스트하세요" 안내 포함
- **에러 발생 시** — 에러 메시지를 그대로 붙여넣으면 즉시 디버깅
- **Supabase 직접 쿼리 시** — `profiles`에 직접 INSERT 금지, 트리거 경유 필수

-- seat_roi_configs: 좌석별 폴리곤 ROI 꼭짓점 저장
-- AdminCalibratePage에서 upsert, seat_monitor.py에서 읽음
-- points: normalized [0,1] 좌표 배열 ([[x,y], ...])
create table if not exists public.seat_roi_configs (
  id           bigserial primary key,
  seat_label   text      not null,
  camera_id    text      not null default 'main',
  points       jsonb     not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  unique (seat_label, camera_id)
);

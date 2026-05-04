-- seats 테이블 초기 데이터
-- Supabase SQL Editor에서 실행

INSERT INTO public.seats (seat_number, status, has_person, has_items, last_updated)
VALUES
  ('N21', 'available', false, false, now()),
  ('N22', 'available', false, false, now()),
  ('N23', 'available', false, false, now()),
  ('N25', 'available', false, false, now()),
  ('N27', 'available', false, false, now())
ON CONFLICT DO NOTHING;

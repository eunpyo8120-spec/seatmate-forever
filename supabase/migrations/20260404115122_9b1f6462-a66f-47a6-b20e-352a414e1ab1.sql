
-- Create reservations table
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  floor TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: only one active reservation per seat
CREATE UNIQUE INDEX idx_reservations_active_seat
  ON public.reservations (floor, seat_number)
  WHERE is_active = true;

-- Unique constraint: only one active reservation per user
CREATE UNIQUE INDEX idx_reservations_active_user
  ON public.reservations (user_id)
  WHERE is_active = true;

-- Index for querying active reservations
CREATE INDEX idx_reservations_active ON public.reservations (is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can see all reservations (to see seat statuses)
CREATE POLICY "Authenticated users can view all reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (true);

-- Users can create their own reservations
CREATE POLICY "Users can create their own reservations"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reservations
CREATE POLICY "Users can update their own reservations"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own reservations
CREATE POLICY "Users can delete their own reservations"
  ON public.reservations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

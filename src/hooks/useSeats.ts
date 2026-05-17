import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type SeatRow = Tables<'seats'>;

export function useSeats() {
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`seats-realtime-${Math.random()}`);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('seats')
        .select('*')
        .order('seat_number');

      if (!error && data) {
        setSeats(data);
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats' },
        () => { load(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { seats, loading };
}

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SeatRow {
  seat_number: string;
  status: string;
  has_person: boolean;
  has_items: boolean;
  last_updated: string;
}

export function useSeats() {
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`seats-realtime-${Math.random()}`);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('seats')
        .select('*')
        .order('seat_number');

      if (!error && data) {
        setSeats(data as SeatRow[]);
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

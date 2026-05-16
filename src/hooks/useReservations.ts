import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import { useAuth } from './useAuth';
import { getSeatLabel } from '@/lib/seatLabel';
import type { SeatStatus } from '@/types/seat';

export const useReservations = () => {
  const { user } = useAuth();
  const setSeatStatuses = useAppStore(s => s.setSeatStatuses);
  const setMySeat = useAppStore(s => s.setMySeat);
  const channelName = useRef(`reservations-realtime-${Math.random()}`);

  const fetchReservations = useCallback(async () => {
    // Expire overdue reservations before fetching
    await supabase
      .from('reservations')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('end_time', new Date().toISOString());

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch reservations:', error);
      return;
    }

    // Build seat statuses from reservations
    // Get current statuses template (all available)
    const currentStatuses = useAppStore.getState().seatStatuses || {};
    const updatedStatuses: Record<string, Record<number, SeatStatus>> = {};

    Object.keys(currentStatuses).forEach(floor => {
      updatedStatuses[floor] = {};
      const floorSeats = currentStatuses[floor] || {};
      Object.keys(floorSeats).forEach(key => {
        updatedStatuses[floor][Number(key)] = 'available';
      });
    });

    // Apply reservations
    let myReservation: typeof data[0] | null = null;
    data?.forEach(r => {
      const floor = r.floor;
      if (updatedStatuses[floor]) {
        if (user && r.user_id === user.id) {
          updatedStatuses[floor][r.seat_number] = 'mine';
          myReservation = r;
        } else {
          updatedStatuses[floor][r.seat_number] = 'occupied';
        }
      }
    });

    setSeatStatuses(updatedStatuses);

    if (myReservation) {
      const r = myReservation as typeof data[0];
      setMySeat({
        floor: r.floor,
        seatNumber: r.seat_number,
        startTime: new Date(r.start_time),
        endTime: new Date(r.end_time),
      });
    } else {
      setMySeat(null);
    }
  }, [user, setSeatStatuses, setMySeat]);

  // Subscribe to realtime changes
  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          fetchReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReservations]);

  const reserveSeat = async (floor: string, seatNumber: number) => {
    if (!user) return { error: 'Not authenticated' };

    const now = new Date();
    const endTime = new Date(now.getTime() + 10 * 60 * 1000);

    const { error } = await supabase.from('reservations').insert({
      user_id: user.id,
      floor,
      seat_number: seatNumber,
      start_time: now.toISOString(),
      end_time: endTime.toISOString(),
    });

    if (error) {
      console.error('Reserve failed:', error);
      return { error: error.message };
    }

    await fetchReservations();
    return { error: null };
  };

  const checkoutSeat = async () => {
    if (!user) return;

    const { data: current } = await supabase
      .from('reservations')
      .select('seat_number, floor')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const { error } = await supabase
      .from('reservations')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error('Checkout failed:', error);
      return;
    }

    if (current) {
      const seatLabel = getSeatLabel(current.seat_number);
      const { data: seatRow } = await supabase
        .from('seats')
        .select('has_items')
        .eq('seat_number', seatLabel)
        .single();

      if (seatRow) {
        if (!seatRow.has_items) {
          // Case A: 물건 없음 — 10초 후 available
          setTimeout(async () => {
            await supabase
              .from('seats')
              .update({ status: 'available' })
              .eq('seat_number', seatLabel);
          }, 10_000);
        } else {
          // Case B: 물건 있음 — 즉시 managed
          await supabase
            .from('seats')
            .update({ status: 'managed' })
            .eq('seat_number', seatLabel);
          // Case C: 30초 후 lost_item
          setTimeout(async () => {
            await supabase
              .from('seats')
              .update({ status: 'lost_item' })
              .eq('seat_number', seatLabel);
          }, 30_000);
        }
      }
    }

    await fetchReservations();
  };

  const extendSeat = async () => {
    if (!user) return;

    const { data: current } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!current) return;

    const newEnd = new Date(new Date(current.end_time).getTime() + 2 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('reservations')
      .update({ end_time: newEnd.toISOString() })
      .eq('id', current.id);

    if (error) {
      console.error('Extend failed:', error);
      return;
    }

    await fetchReservations();
  };

  const adminCheckoutSeat = async (floor: string, seatNumber: number) => {
    const { error } = await supabase
      .from('reservations')
      .update({ is_active: false })
      .eq('floor', floor)
      .eq('seat_number', seatNumber)
      .eq('is_active', true);

    if (error) {
      console.error('Admin checkout failed:', error);
      return { error: error.message };
    }

    await fetchReservations();
    return { error: null };
  };

  return { fetchReservations, reserveSeat, checkoutSeat, extendSeat, adminCheckoutSeat };
};

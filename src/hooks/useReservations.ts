import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import { useAuthContext } from './useAuth';
import type { SeatStatus } from '@/types/seat';

export const useReservations = () => {
  const { user } = useAuthContext();
  const channelName = useRef(`reservations-realtime-${Math.random()}`);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchReservationsRef = useRef<() => Promise<void>>(async () => {});

  const fetchReservations = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('is_active', true)
      .gt('end_time', new Date().toISOString());

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

    // Atomic update — prevents intermediate render where seatStatuses updated but mySeat stale
    const r = myReservation as typeof data[0] | null;
    useAppStore.setState({
      seatStatuses: updatedStatuses,
      mySeat: r
        ? { floor: r.floor, seatNumber: r.seat_number, startTime: new Date(r.start_time), endTime: new Date(r.end_time) }
        : null,
      reservationsLoaded: true,
    });

    // Auto-expiry timer: re-fetch when reservation end_time is reached
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (r) {
      const delay = new Date(r.end_time).getTime() - Date.now();
      if (delay > 0) {
        expiryTimerRef.current = setTimeout(() => fetchReservationsRef.current(), delay + 1000);
      }
    }
  }, [user]);

  // Keep ref pointing to latest fetchReservations (used by expiry timer)
  useEffect(() => {
    fetchReservationsRef.current = fetchReservations;
  }, [fetchReservations]);

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
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
      }
    };
  }, [fetchReservations]);

  const reserveSeat = async (floor: string, seatNumber: number) => {
    if (!user) return { error: 'Not authenticated' };

    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) return { error: '이미 예약된 좌석이 있습니다' };

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

    await fetchReservations();
  };

  const extendSeat = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: '로그인이 필요합니다' };

    const { data: current } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!current) return { error: '활성 예약이 없습니다' };

    const newEnd = new Date(new Date(current.end_time).getTime() + 2 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('reservations')
      .update({ end_time: newEnd.toISOString() })
      .eq('id', current.id);

    if (error) return { error: error.message };

    await fetchReservations();
    return { error: null };
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

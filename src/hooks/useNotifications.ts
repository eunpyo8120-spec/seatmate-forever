import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import { useAuthContext } from './useAuth';
import type { Notification } from '@/types/seat';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function floorLabel(floor: string): string {
  return floor === '4N' ? '4층 노상일열람실' : `${floor}층`;
}

export function useNotifications() {
  const { user } = useAuthContext();
  const setNotifications = useAppStore(s => s.setNotifications);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !reservations) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const notifs: Notification[] = [];

      const activeRes = reservations.find(
        r => r.is_active && new Date(r.end_time) > now
      );

      // 사석화 경고 (활성 예약 좌석이 ghost 상태)
      if (activeRes && activeRes.floor === '4N') {
        const seatLabel = `N${activeRes.seat_number}`;
        const { data: seat } = await supabase
          .from('seats')
          .select('status')
          .eq('seat_number', seatLabel)
          .single();

        if (seat?.status === 'ghost') {
          notifs.push({
            id: `ghost-${activeRes.id}`,
            type: 'warning',
            title: '사석화 경고',
            message: `${seatLabel} 좌석이 장시간 비어있습니다. 자동 퇴실 처리될 수 있습니다.`,
            time: '지금',
            read: false,
          });
        }
      }

      // 퇴실 시간 임박 (30분 이내)
      if (activeRes) {
        const minsLeft = (new Date(activeRes.end_time).getTime() - now.getTime()) / 60000;
        if (minsLeft <= 30) {
          notifs.push({
            id: `expiring-${activeRes.id}`,
            type: 'warning',
            title: '퇴실 시간 임박',
            message: `${Math.floor(minsLeft)}분 후 예약이 만료됩니다. 연장하시겠어요?`,
            time: '지금',
            read: false,
          });
        }
      }

      // 예약 이력 → 알림 변환
      for (const r of reservations) {
        const isActive = r.is_active && new Date(r.end_time) > now;

        if (isActive) {
          notifs.push({
            id: `reserved-${r.id}`,
            type: 'confirmed',
            title: '좌석 배정 완료',
            message: `${floorLabel(r.floor)} ${r.seat_number}번 좌석이 배정되었습니다.`,
            time: relativeTime(r.created_at),
            read: false,
          });
        } else {
          notifs.push({
            id: `expired-${r.id}`,
            type: 'expired',
            title: '예약 종료',
            message: `${floorLabel(r.floor)} ${r.seat_number}번 좌석 이용이 종료되었습니다.`,
            time: relativeTime(r.end_time),
            read: false,
          });
        }
      }

      setNotifications(notifs);
      setLoading(false);
    }

    load();
  }, [user, setNotifications]);

  return { loading };
}

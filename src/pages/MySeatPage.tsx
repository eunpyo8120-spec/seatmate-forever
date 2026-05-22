import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useReservations } from '@/hooks/useReservations';
import { useSeatsContext } from '@/hooks/useSeats';
import { BottomNav } from '@/components/BottomNav';
import { MapPin, Clock, Plus, LogOut as LogOutIcon, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { getSeatLabel, getFloorName } from '@/lib/seatLabel';

const STATUS_LABEL: Record<string, string> = {
  available: '사용가능',
  occupied: '이용중',
  ghost: '고스트',
  managed: '관리중',
  lost_item: '분실물',
};

const STATUS_COLOR: Record<string, string> = {
  available: 'text-green-600 bg-green-50',
  occupied: 'text-blue-600 bg-blue-50',
  ghost: 'text-orange-600 bg-orange-50',
  managed: 'text-purple-600 bg-purple-50',
  lost_item: 'text-red-600 bg-red-50',
};

const MySeatPage = () => {
  const { mySeat, reservationsLoaded } = useAppStore();
  const { checkoutSeat, extendSeat } = useReservations({ subscribe: false });
  const { seats } = useSeatsContext();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState('');
  const [loading, setLoading] = useState(false);
  const toastFiredRef = useRef(false);

  useEffect(() => {
    toastFiredRef.current = false;
  }, [mySeat]);

  useEffect(() => {
    if (!mySeat) return;
    const timer = setInterval(() => {
      const diff = mySeat.endTime.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('00:00:00');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);

      if (diff <= 60000 && !toastFiredRef.current) {
        toastFiredRef.current = true;
        toast.warning('예약종료 1분전', { description: '좌석 연장 또는 퇴실을 진행해주세요.' });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [mySeat]);

  const formatTime = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  if (!reservationsLoaded) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <BottomNav />
      </div>
    );
  }

  if (!mySeat) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="font-display font-bold text-lg text-foreground mb-1">배정된 좌석이 없습니다</h2>
          <p className="text-sm font-body text-muted-foreground mb-6">좌석 현황에서 좌석을 선택하세요</p>
          <Button onClick={() => navigate('/seats/2')} className="font-display">
            좌석 선택하기
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-5 py-4">
        <h1 className="font-display font-bold text-lg text-foreground">내 좌석 정보</h1>
      </div>

      <div className="px-5 py-6 space-y-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary rounded-2xl p-6 text-center"
        >
          <p className="text-primary-foreground/70 text-sm font-body mb-2">남은 시간</p>
          <div className="text-5xl font-display font-bold text-primary-foreground tracking-wider mb-1">
            {remaining}
          </div>
          <p className="text-primary-foreground/60 text-xs font-body">
            {formatTime(mySeat.startTime)} ~ {formatTime(mySeat.endTime)}
          </p>
        </motion.div>

        <div className="bg-card rounded-xl p-5 border border-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-display font-bold text-foreground">{getFloorName(mySeat.floor)}</p>
              <p className="text-2xl font-display font-bold text-primary">{getSeatLabel(mySeat.seatNumber)}번</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>입실: {formatTime(mySeat.startTime)} | 퇴실예정: {formatTime(mySeat.endTime)}</span>
          </div>
        </div>

        {(() => {
          const seatLabel = getSeatLabel(mySeat.seatNumber);
          const seatRow = seats.find(s => s.seat_number === seatLabel);
          return (
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-display font-semibold text-foreground">센서 감지 현황</span>
              </div>
              {seatRow ? (
                <div className="space-y-2 text-sm font-body">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">좌석 상태</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[seatRow.status] ?? 'text-foreground bg-muted'}`}>
                      {STATUS_LABEL[seatRow.status] ?? seatRow.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">사람 감지</span>
                    <span>{seatRow.has_person ? '✅ 있음' : '❌ 없음'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">물건 감지</span>
                    <span>{seatRow.has_items ? '✅ 있음' : '❌ 없음'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">마지막 업데이트</span>
                    <span className="text-xs text-right">
                      {new Date(seatRow.last_updated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-body text-muted-foreground">센서 미연결 ({seatLabel})</p>
              )}
            </div>
          );
        })()}

        <div className="space-y-3">
          <Button
            onClick={async () => {
              setLoading(true);
              const { error } = await extendSeat();
              setLoading(false);
              if (error) {
                toast.error('연장 실패: ' + error);
              } else {
                toast.success('2시간 연장되었습니다.');
              }
            }}
            variant="outline"
            className="w-full h-12 font-display font-semibold text-base"
            disabled={loading}
          >
            <Plus className="w-5 h-5 mr-2" />
            시간 연장 (2시간)
          </Button>
          <Button
            onClick={async () => {
              setLoading(true);
              await checkoutSeat();
              setLoading(false);
              navigate('/main');
            }}
            variant="destructive"
            className="w-full h-12 font-display font-semibold text-base"
            disabled={loading}
          >
            <LogOutIcon className="w-5 h-5 mr-2" />
            퇴실하기
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default MySeatPage;

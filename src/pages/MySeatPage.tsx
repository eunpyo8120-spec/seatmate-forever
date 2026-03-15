import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { BottomNav } from '@/components/BottomNav';
import { MapPin, Clock, Plus, LogOut as LogOutIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const MySeatPage = () => {
  const { mySeat, checkoutSeat, extendSeat } = useAppStore();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState('');

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
    }, 1000);
    return () => clearInterval(timer);
  }, [mySeat]);

  const formatTime = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

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
        {/* Timer Card */}
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

        {/* Seat Info */}
        <div className="bg-card rounded-xl p-5 border border-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-display font-bold text-foreground">{mySeat.floor}층 열람실</p>
              <p className="text-2xl font-display font-bold text-primary">{mySeat.seatNumber}번</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>입실: {formatTime(mySeat.startTime)} | 퇴실예정: {formatTime(mySeat.endTime)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={extendSeat}
            variant="outline"
            className="w-full h-12 font-display font-semibold text-base"
          >
            <Plus className="w-5 h-5 mr-2" />
            시간 연장 (2시간)
          </Button>
          <Button
            onClick={() => {
              checkoutSeat();
              navigate('/main');
            }}
            variant="destructive"
            className="w-full h-12 font-display font-semibold text-base"
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

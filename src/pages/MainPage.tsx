import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { useAuthContext } from '@/hooks/useAuth';
import { useReservations } from '@/hooks/useReservations';
import { useSeats } from '@/hooks/useSeats';
import { BottomNav } from '@/components/BottomNav';
import { SeatStatusTable } from '@/components/SeatStatusTable';
import { MapPin, Clock, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const MainPage = () => {
  const { userName, mySeat, seatStatuses } = useAppStore();
  const { signOut } = useAuthContext();
  const { checkoutSeat } = useReservations();
  const { seats, loading: seatsLoading } = useSeats();
  const navigate = useNavigate();

  const getAvailableCount = (floor: string) => {
    const s = seatStatuses[floor];
    return Object.values(s).filter(v => v === 'available').length;
  };

  const getTotalCount = (floor: string) => Object.keys(seatStatuses[floor]).length;

  const formatTime = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary px-5 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-foreground/70 text-sm font-body">안녕하세요,</p>
            <h1 className="text-xl font-display font-bold text-primary-foreground">{userName}님</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="px-5 -mt-4 space-y-4">
        {mySeat ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-5 shadow-sm border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-display font-semibold text-available bg-available/10 px-2 py-1 rounded-full">이용중</span>
              <span className="text-xs font-body text-muted-foreground">
                {formatTime(mySeat.startTime)} ~ {formatTime(mySeat.endTime)}
              </span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-lg text-foreground">{mySeat.floor}층 열람실</p>
                <p className="text-sm font-body text-muted-foreground">{mySeat.seatNumber}번 좌석</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10 font-display text-sm"
                onClick={() => navigate('/my-seat')}
              >
                상세보기
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-10 font-display text-sm"
                onClick={checkoutSeat}
              >
                퇴실하기
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border text-center">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-display font-semibold text-foreground">배정된 좌석이 없습니다</p>
            <p className="text-sm font-body text-muted-foreground mt-1">아래에서 열람실을 선택하세요</p>
          </div>
        )}

        <div>
          <h2 className="font-display font-semibold text-foreground mb-3">열람실 선택</h2>
          <div className="space-y-3">
            {[
              { floor: '2', badge: '2F', name: '2층 1열람실', total: getTotalCount('2'), available: getAvailableCount('2') },
              { floor: '4', badge: '4F', name: '4층 2열람실', total: getTotalCount('4'), available: getAvailableCount('4') },
              { floor: '4N', badge: '4NF', name: '4층 노상일열람실', total: getTotalCount('4N'), available: getAvailableCount('4N') },
              { floor: 'TEST', badge: 'TEST', name: '테스트 열람실 (N구역)', total: getTotalCount('TEST'), available: getAvailableCount('TEST') },
            ].map(room => (
              <motion.button
                key={room.floor}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-card rounded-xl p-4 shadow-sm border border-border flex items-center justify-between text-left"
                onClick={() => navigate(`/seats/${room.floor}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-display font-bold text-primary text-sm">{room.badge}</span>
                  </div>
                  <div>
                    <p className="font-display font-semibold text-foreground">{room.name}</p>
                    <p className="text-xs font-body text-muted-foreground">
                      잔여 <span className="text-available font-semibold">{room.available}</span> / {room.total}석
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display font-semibold text-foreground mb-3">카메라 모니터링 좌석</h2>
          <SeatStatusTable seats={seats} loading={seatsLoading} />
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default MainPage;

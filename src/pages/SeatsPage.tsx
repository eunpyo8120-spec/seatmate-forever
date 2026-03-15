import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { BottomNav } from '@/components/BottomNav';
import { SeatLegend } from '@/components/SeatLegend';
import { Floor2SeatMap } from '@/components/Floor2SeatMap';
import { Floor4SeatMap } from '@/components/Floor4SeatMap';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SeatsPage = () => {
  const { floor } = useParams<{ floor: string }>();
  const navigate = useNavigate();
  const { seatStatuses, reserveSeat, mySeat, isAdmin, adminCheckoutSeat } = useAppStore();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const currentFloor = floor || '2';
  const statuses = seatStatuses[currentFloor] || {};
  const floorName = currentFloor === '2' ? '2층 1열람실' : '4층 2열람실';

  const handleSeatClick = (seatNum: number) => {
    const status = statuses[seatNum];
    if (isAdmin) {
      // Admin can select any occupied seat to force checkout, or available to reserve
      setSelectedSeat(seatNum);
      return;
    }
    if (mySeat) return; // already have a seat
    if (status !== 'available') return;
    setSelectedSeat(seatNum);
  };

  const confirmReservation = () => {
    if (selectedSeat !== null) {
      reserveSeat(Number(currentFloor), selectedSeat);
      setSelectedSeat(null);
      navigate('/my-seat');
    }
  };

  const availableCount = Object.values(statuses).filter(v => v === 'available').length;
  const totalCount = Object.keys(statuses).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-foreground">{floorName}</h1>
          <p className="text-xs font-body text-muted-foreground">
            잔여 <span className="text-available font-semibold">{availableCount}</span> / {totalCount}석
          </p>
        </div>
        {/* Floor tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {['2', '4'].map(f => (
            <button
              key={f}
              onClick={() => navigate(`/seats/${f}`)}
              className={`px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors ${
                currentFloor === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}층
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <SeatLegend />
        {mySeat && (
          <p className="text-xs text-destructive font-body mt-2">
            * 이미 배정된 좌석이 있어 새 좌석을 선택할 수 없습니다.
          </p>
        )}
      </div>

      {/* Seat Map */}
      {currentFloor === '2' ? (
        <Floor2SeatMap statuses={statuses} onSeatClick={handleSeatClick} />
      ) : (
        <Floor4SeatMap statuses={statuses} onSeatClick={handleSeatClick} />
      )}

      {/* Confirmation Dialog */}
      <Dialog open={selectedSeat !== null} onOpenChange={() => setSelectedSeat(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">좌석 배정 확인</DialogTitle>
            <DialogDescription className="font-body">
              {floorName} <span className="font-semibold text-foreground">{selectedSeat}번</span> 좌석을 배정하시겠습니까?
              <br />
              <span className="text-xs text-muted-foreground">이용시간: 4시간 (연장 가능)</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedSeat(null)} className="flex-1">
              취소
            </Button>
            <Button onClick={confirmReservation} className="flex-1">
              배정하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SeatsPage;

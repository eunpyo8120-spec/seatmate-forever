import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSeatLabel, getFloorName } from '@/lib/seatLabel';
import { useAppStore } from '@/store/appStore';
import { BottomNav } from '@/components/BottomNav';
import { SeatLegend } from '@/components/SeatLegend';
import { Floor2SeatMap } from '@/components/Floor2SeatMap';
import { Floor4SeatMap } from '@/components/Floor4SeatMap';
import { Floor4NSeatMap } from '@/components/Floor4NSeatMap';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const SeatsPage = () => {
  const { floor } = useParams<{ floor: string }>();
  const navigate = useNavigate();
  const { seatStatuses, reserveSeat, mySeat, isAdmin, adminCheckoutSeat, adminAssignSeat } = useAppStore();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [adminSelectedSeats, setAdminSelectedSeats] = useState<Set<number>>(new Set());
  const [adminAction, setAdminAction] = useState<'assign' | 'checkout' | null>(null);

  const currentFloor = floor || '2';
  const statuses = seatStatuses[currentFloor] || {};
  const floorName = currentFloor === '2' ? '2층 1열람실' : currentFloor === '4' ? '4층 2열람실' : '4층 노상일열람실';

  const handleSeatClick = (seatNum: number) => {
    const status = statuses[seatNum];

    if (isAdmin) {
      // Admin multi-select toggle
      setAdminSelectedSeats(prev => {
        const next = new Set(prev);
        if (next.has(seatNum)) {
          next.delete(seatNum);
        } else {
          next.add(seatNum);
        }
        return next;
      });
      return;
    }

    if (mySeat) return;
    if (status !== 'available') return;
    setSelectedSeat(seatNum);
  };

  const handleAdminBatchAssign = () => {
    const available = [...adminSelectedSeats].filter(s => statuses[s] === 'available');
    if (available.length === 0) {
      toast.error('배정 가능한 좌석이 선택되지 않았습니다.');
      return;
    }
    setAdminAction('assign');
  };

  const handleAdminBatchCheckout = () => {
    const occupied = [...adminSelectedSeats].filter(s => statuses[s] === 'occupied' || statuses[s] === 'mine');
    if (occupied.length === 0) {
      toast.error('퇴실 가능한 좌석이 선택되지 않았습니다.');
      return;
    }
    setAdminAction('checkout');
  };

  const confirmAdminAction = () => {
    const floorNum = Number(currentFloor);
    if (adminAction === 'assign') {
      const seats = [...adminSelectedSeats].filter(s => statuses[s] === 'available');
      seats.forEach(s => adminAssignSeat(floorNum, s));
      toast.success(`${seats.length}석 배정 완료`);
    } else if (adminAction === 'checkout') {
      const seats = [...adminSelectedSeats].filter(s => statuses[s] === 'occupied' || statuses[s] === 'mine');
      seats.forEach(s => adminCheckoutSeat(floorNum, s));
      toast.success(`${seats.length}석 퇴실 완료`);
    }
    setAdminSelectedSeats(new Set());
    setAdminAction(null);
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

  const selectedAvailableCount = [...adminSelectedSeats].filter(s => statuses[s] === 'available').length;
  const selectedOccupiedCount = [...adminSelectedSeats].filter(s => statuses[s] === 'occupied' || statuses[s] === 'mine').length;

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
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {[
            { key: '2', label: '2층' },
            { key: '4', label: '4층' },
            { key: '4N', label: '노상일' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => { navigate(`/seats/${f.key}`); setAdminSelectedSeats(new Set()); }}
              className={`px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors ${
                currentFloor === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <SeatLegend />
        {!isAdmin && mySeat && (
          <p className="text-xs text-destructive font-body mt-2">
            * 이미 배정된 좌석이 있어 새 좌석을 선택할 수 없습니다.
          </p>
        )}
      </div>

      {/* Admin toolbar */}
      {isAdmin && adminSelectedSeats.size > 0 && (
        <div className="sticky top-[60px] z-30 bg-card border-b border-border px-4 py-2 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-xs font-display font-semibold text-foreground">
            {adminSelectedSeats.size}석 선택됨
          </span>
          <div className="flex-1" />
          {selectedAvailableCount > 0 && (
            <Button size="sm" variant="default" onClick={handleAdminBatchAssign} className="text-xs h-7">
              배정 ({selectedAvailableCount})
            </Button>
          )}
          {selectedOccupiedCount > 0 && (
            <Button size="sm" variant="destructive" onClick={handleAdminBatchCheckout} className="text-xs h-7">
              퇴실 ({selectedOccupiedCount})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAdminSelectedSeats(new Set())} className="text-xs h-7">
            초기화
          </Button>
        </div>
      )}

      {/* Seat Map */}
      {currentFloor === '2' ? (
        <Floor2SeatMap statuses={statuses} onSeatClick={handleSeatClick} selectedSeats={isAdmin ? adminSelectedSeats : undefined} />
      ) : currentFloor === '4' ? (
        <Floor4SeatMap statuses={statuses} onSeatClick={handleSeatClick} selectedSeats={isAdmin ? adminSelectedSeats : undefined} />
      ) : (
        <Floor4NSeatMap statuses={statuses} onSeatClick={handleSeatClick} selectedSeats={isAdmin ? adminSelectedSeats : undefined} />
      )}

      {/* User Reservation Dialog */}
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
            <Button variant="outline" onClick={() => setSelectedSeat(null)} className="flex-1">취소</Button>
            <Button onClick={confirmReservation} className="flex-1">배정하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Batch Action Dialog */}
      <Dialog open={adminAction !== null} onOpenChange={() => setAdminAction(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">
              {adminAction === 'assign' ? '일괄 배정 확인' : '일괄 퇴실 확인'}
            </DialogTitle>
            <DialogDescription className="font-body">
              {adminAction === 'assign' ? (
                <>선택된 <span className="font-semibold text-foreground">{selectedAvailableCount}석</span>을 사용중으로 배정하시겠습니까?</>
              ) : (
                <>선택된 <span className="font-semibold text-foreground">{selectedOccupiedCount}석</span>을 퇴실 처리하시겠습니까?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setAdminAction(null)} className="flex-1">취소</Button>
            <Button onClick={confirmAdminAction} className="flex-1" variant={adminAction === 'checkout' ? 'destructive' : 'default'}>
              {adminAction === 'assign' ? '배정하기' : '퇴실하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SeatsPage;

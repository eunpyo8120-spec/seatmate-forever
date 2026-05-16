import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSeatLabel, getFloorName } from '@/lib/seatLabel';
import { useAppStore } from '@/store/appStore';
import { useReservations } from '@/hooks/useReservations';
import { BottomNav } from '@/components/BottomNav';
import { SeatLegend } from '@/components/SeatLegend';
import { Floor2SeatMap } from '@/components/Floor2SeatMap';
import { Floor4SeatMap } from '@/components/Floor4SeatMap';
import { Floor4NSeatMap } from '@/components/Floor4NSeatMap';
import { FloorTestSeatMap } from '@/components/FloorTestSeatMap';
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
import { toast } from 'sonner';

const SeatsPage = () => {
  const { floor } = useParams<{ floor: string }>();
  const navigate = useNavigate();
  const { seatStatuses, mySeat, isAdmin } = useAppStore();
  const { reserveSeat, adminCheckoutSeat } = useReservations();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [adminTarget, setAdminTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const currentFloor = floor || '2';
  const statuses = seatStatuses[currentFloor] || {};
  const floorName = currentFloor === '2' ? '2층 1열람실' : currentFloor === '4' ? '4층 2열람실' : '4층 노상일열람실';

  const handleSeatClick = (seatNum: number) => {
    const status = statuses[seatNum];
    if (isAdmin && (status === 'occupied' || status === 'mine')) {
      setAdminTarget(seatNum);
      return;
    }
    if (!isAdmin && mySeat) return;
    if (status !== 'available') return;
    setSelectedSeat(seatNum);
  };

  const confirmReservation = async () => {
    if (selectedSeat === null) return;
    setLoading(true);
    const { error } = await reserveSeat(currentFloor, selectedSeat);
    setLoading(false);
    if (error) {
      toast.error('좌석 배정에 실패했습니다: ' + error);
    } else {
      toast.success(`${floorName} ${getSeatLabel(selectedSeat)}번 좌석이 배정되었습니다.`);
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
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {[
            { key: '2', label: '2층' },
            { key: '4', label: '4층' },
            { key: '4N', label: '노상일' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => navigate(`/seats/${f.key}`)}
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
        {mySeat && !isAdmin && (
          <p className="text-xs text-destructive font-body mt-2">
            * 이미 배정된 좌석이 있어 새 좌석을 선택할 수 없습니다.
          </p>
        )}
        {isAdmin && (
          <p className="text-xs text-primary font-body mt-2 font-semibold">
            * 관리자 모드: 점유 좌석 클릭 시 강제 퇴실, 여러 좌석 예약 가능
          </p>
        )}
      </div>

      {/* Seat Map */}
      <div className="flex justify-center">
        {currentFloor === '2' ? (
          <Floor2SeatMap statuses={statuses} onSeatClick={handleSeatClick} />
        ) : currentFloor === '4' ? (
          <Floor4SeatMap statuses={statuses} onSeatClick={handleSeatClick} />
        ) : currentFloor === 'TEST' ? (
          <FloorTestSeatMap statuses={statuses} onSeatClick={handleSeatClick} />
        ) : (
          <Floor4NSeatMap statuses={statuses} onSeatClick={handleSeatClick} />
        )}
      </div>

      {/* Admin Checkout Dialog */}
      <Dialog open={adminTarget !== null} onOpenChange={() => setAdminTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">관리자 퇴실 처리</DialogTitle>
            <DialogDescription className="font-body">
              {floorName} <span className="font-semibold text-foreground">{adminTarget !== null ? getSeatLabel(adminTarget) : ''}번</span> 좌석을 강제 퇴실 처리하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setAdminTarget(null)} className="flex-1" disabled={loading}>취소</Button>
            <Button variant="destructive" className="flex-1" disabled={loading} onClick={async () => {
              if (adminTarget === null) return;
              setLoading(true);
              const { error } = await adminCheckoutSeat(currentFloor, adminTarget);
              setLoading(false);
              if (error) {
                toast.error('퇴실 처리 실패: ' + error);
              } else {
                toast.success(`${getSeatLabel(adminTarget)}번 좌석 퇴실 처리 완료`);
                setAdminTarget(null);
              }
            }}>
              {loading ? '처리중...' : '퇴실 처리'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservation Dialog */}
      <Dialog open={selectedSeat !== null} onOpenChange={() => setSelectedSeat(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">좌석 배정 확인</DialogTitle>
            <DialogDescription className="font-body">
              {floorName} <span className="font-semibold text-foreground">{selectedSeat !== null ? getSeatLabel(selectedSeat) : ''}번</span> 좌석을 배정하시겠습니까?
              <br />
              <span className="text-xs text-muted-foreground">이용시간: 4시간 (연장 가능)</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedSeat(null)} className="flex-1" disabled={loading}>취소</Button>
            <Button onClick={confirmReservation} className="flex-1" disabled={loading}>
              {loading ? '처리중...' : '배정하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SeatsPage;

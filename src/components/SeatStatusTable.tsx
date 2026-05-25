import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SeatRow } from '@/hooks/useSeats';
import { SEAT_STATUS_LABEL, SEAT_STATUS_CLASS } from '@/lib/seatStatus';

interface Props {
  seats: SeatRow[];
  loading: boolean;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function SeatStatusTable({ seats, loading }: Props) {
  if (loading) {
    return (
      <div className="text-xs text-muted-foreground py-3 text-center font-body">
        불러오는 중...
      </div>
    );
  }

  if (seats.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-3 text-center font-body">
        감지된 좌석 없음
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-display font-semibold text-xs w-16">좌석</TableHead>
            <TableHead className="font-display font-semibold text-xs">상태</TableHead>
            <TableHead className="font-display font-semibold text-xs w-12 text-center">사람</TableHead>
            <TableHead className="font-display font-semibold text-xs w-12 text-center">물건</TableHead>
            <TableHead className="font-display font-semibold text-xs text-right">업데이트</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seats.map((seat) => {
            const s = { label: SEAT_STATUS_LABEL[seat.status] ?? seat.status, className: SEAT_STATUS_CLASS[seat.status] ?? 'bg-muted text-muted-foreground' };
            return (
              <TableRow key={seat.seat_number}>
                <TableCell className="font-display font-bold text-sm">{seat.seat_number}</TableCell>
                <TableCell>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-display font-semibold ${s.className}`}>
                    {s.label}
                  </span>
                </TableCell>
                <TableCell className="text-center text-base">{seat.has_person ? '✅' : '❌'}</TableCell>
                <TableCell className="text-center text-base">{seat.has_items ? '✅' : '❌'}</TableCell>
                <TableCell className="text-right text-xs font-body text-muted-foreground">
                  {relativeTime(seat.last_updated)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

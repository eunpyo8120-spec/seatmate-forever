import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SeatRow } from '@/hooks/useSeats';

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

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  available: { label: '사용가능', className: 'bg-green-100 text-green-700' },
  occupied:  { label: '이용중',   className: 'bg-red-100 text-red-700' },
  reserved:  { label: '자리맡음', className: 'bg-yellow-100 text-yellow-700' },
  ghost:     { label: '자리비움', className: 'bg-gray-100 text-gray-500' },
  managed:      { label: '자율관리위원회', className: 'bg-blue-100 text-blue-700' },
  lost_item:    { label: '분실물',        className: 'bg-orange-100 text-orange-700' },
  unauthorized: { label: '무단점유',      className: 'bg-red-100 text-red-700' },
};

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
            const s = STATUS_LABEL[seat.status] ?? { label: seat.status, className: 'bg-muted text-muted-foreground' };
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

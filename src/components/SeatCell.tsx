import type { SeatStatus } from '@/types/seat';
import { cn } from '@/lib/utils';

interface SeatCellProps {
  number: number;
  status: SeatStatus;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

const statusClasses: Record<SeatStatus, string> = {
  available: 'seat-available',
  occupied: 'seat-occupied',
  mine: 'seat-mine',
  disabled: 'seat-disabled',
  warning: 'seat-warning',
};

export const SeatCell = ({ number, status, onClick, size = 'md' }: SeatCellProps) => {
  const sizeClass = size === 'sm' ? 'w-8 h-7 text-[10px]' : 'w-10 h-8 text-xs';
  
  return (
    <button
      className={cn(
        sizeClass,
        'rounded-sm font-display font-medium flex items-center justify-center transition-all duration-150 select-none',
        statusClasses[status],
      )}
      onClick={status === 'available' ? onClick : undefined}
      disabled={status !== 'available' && status !== 'mine'}
      title={`${number}번 - ${status === 'available' ? '사용가능' : status === 'occupied' ? '사용중' : status === 'mine' ? '내 좌석' : status === 'warning' ? '확인필요' : '사용불가'}`}
    >
      {number}
    </button>
  );
};

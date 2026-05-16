import type { SeatStatus } from '@/types/seat';
import { cn } from '@/lib/utils';

interface SeatCellProps {
  number: number;
  label?: string;
  status: SeatStatus;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
}

const statusClasses: Record<SeatStatus, string> = {
  available: 'seat-available',
  occupied: 'seat-occupied',
  mine: 'seat-mine',
  disabled: 'seat-disabled',
  warning: 'seat-warning',
};

export const SeatCell = ({ number, label, status, onClick, size = 'md', selected }: SeatCellProps) => {
  const sizeClass = size === 'sm' ? 'w-8 h-7 text-[10px]' : size === 'lg' ? 'w-28 h-24 text-xl' : 'w-10 h-8 text-xs';
  const displayLabel = label || String(number);
  
  return (
    <button
      className={cn(
        sizeClass,
        'rounded-sm font-display font-medium flex items-center justify-center transition-all duration-150 select-none',
        statusClasses[status],
        selected && 'ring-2 ring-primary ring-offset-1 scale-110 z-10',
      )}
      onClick={onClick}
      title={`${displayLabel}번 - ${status === 'available' ? '사용가능' : status === 'occupied' ? '사용중' : status === 'mine' ? '내 좌석' : status === 'warning' ? '확인필요' : '사용불가'}`}
    >
      {displayLabel}
    </button>
  );
};

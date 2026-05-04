import { SeatCell } from './SeatCell';
import type { SeatStatus } from '@/types/seat';

interface Props {
  statuses: Record<number, SeatStatus>;
  onSeatClick: (num: number) => void;
  selectedSeats?: Set<number>;
}

const nLabel = (n: number) => `N${n - 100}`;

export const FloorTestSeatMap = ({ statuses, onSeatClick, selectedSeats }: Props) => {
  const cell = (id: number) => (
    <SeatCell
      key={id}
      number={id}
      label={nLabel(id)}
      status={statuses[id] || 'available'}
      onClick={() => onSeatClick(id)}
      size="sm"
      selected={selectedSeats?.has(id)}
    />
  );

  return (
    <div className="overflow-auto p-4">
      <div className="flex flex-col items-start gap-2">
        <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">
          테스트 좌석 (카메라 모니터링)
        </div>
        <div className="border border-border rounded-md p-3 inline-flex flex-col gap-0.5">
          <div className="flex gap-0.5">
            {cell(123)}
            {cell(127)}
          </div>
          <div className="flex gap-0.5">
            {cell(122)}
            {cell(125)}
          </div>
        </div>
      </div>
    </div>
  );
};

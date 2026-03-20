import { SeatCell } from './SeatCell';
import type { SeatStatus } from '@/types/seat';

interface Props {
  statuses: Record<number, SeatStatus>;
  onSeatClick: (num: number) => void;
  selectedSeats?: Set<number>;
}

const SeatBlock = ({ seats, statuses, onSeatClick, selectedSeats }: { seats: number[][]; statuses: Record<number, SeatStatus>; onSeatClick: (n: number) => void; selectedSeats?: Set<number> }) => (
  <div className="inline-flex flex-col gap-0.5">
    {seats.map((row, i) => (
      <div key={i} className="flex gap-0.5">
        {row.map(n => (
          <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" selected={selectedSeats?.has(n)} />
        ))}
      </div>
    ))}
  </div>
);

export const Floor2SeatMap = ({ statuses, onSeatClick, selectedSeats }: Props) => {
  // Left section: seats 205~324 (10 groups of 2×6)
  const leftGroups = [
    [[210, 209, 208, 207, 206, 205], [216, 215, 214, 213, 212, 211]],
    [[222, 221, 220, 219, 218, 217], [228, 227, 226, 225, 224, 223]],
    [[234, 233, 232, 231, 230, 229], [240, 239, 238, 237, 236, 235]],
    [[246, 245, 244, 243, 242, 241], [252, 251, 250, 249, 248, 247]],
    [[258, 257, 256, 255, 254, 253], [264, 263, 262, 261, 260, 259]],
    [[270, 269, 268, 267, 266, 265], [276, 275, 274, 273, 272, 271]],
    [[282, 281, 280, 279, 278, 277], [288, 287, 286, 285, 284, 283]],
    [[294, 293, 292, 291, 290, 289], [300, 299, 298, 297, 296, 295]],
    [[306, 305, 304, 303, 302, 301], [312, 311, 310, 309, 308, 307]],
    [[318, 317, 316, 315, 314, 313], [324, 323, 322, 321, 320, 319]],
  ];

  // Right section: seats 49~168 (10 groups of 2×6)
  const rightGroups = [
    [[54, 53, 52, 51, 50, 49], [60, 59, 58, 57, 56, 55]],
    [[66, 65, 64, 63, 62, 61], [72, 71, 70, 69, 68, 67]],
    [[78, 77, 76, 75, 74, 73], [84, 83, 82, 81, 80, 79]],
    [[90, 89, 88, 87, 86, 85], [96, 95, 94, 93, 92, 91]],
    [[102, 101, 100, 99, 98, 97], [108, 107, 106, 105, 104, 103]],
    [[114, 113, 112, 111, 110, 109], [120, 119, 118, 117, 116, 115]],
    [[126, 125, 124, 123, 122, 121], [132, 131, 130, 129, 128, 127]],
    [[138, 137, 136, 135, 134, 133], [144, 143, 142, 141, 140, 139]],
    [[150, 149, 148, 147, 146, 145], [156, 155, 154, 153, 152, 151]],
    [[162, 161, 160, 159, 158, 157], [168, 167, 166, 165, 164, 163]],
  ];

  return (
    <div className="overflow-auto p-4">
      <div className="flex gap-8 min-w-[700px]">
        {/* Left Section */}
        <div className="flex flex-col gap-3">
          <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">좌측 구역 (205~324)</div>
          {leftGroups.map((seats, i) => (
            <SeatBlock key={i} seats={seats} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
          ))}
        </div>

        {/* Right Section */}
        <div className="flex flex-col gap-3">
          <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">우측 구역 (49~168)</div>
          {rightGroups.map((seats, i) => (
            <SeatBlock key={i} seats={seats} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
          ))}
        </div>
      </div>
    </div>
  );
};

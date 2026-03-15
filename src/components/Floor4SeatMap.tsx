import { SeatCell } from './SeatCell';
import type { SeatStatus } from '@/types/seat';

interface Props {
  statuses: Record<number, SeatStatus>;
  onSeatClick: (num: number) => void;
}

const SeatBlock = ({ seats, statuses, onSeatClick }: { seats: number[][]; statuses: Record<number, SeatStatus>; onSeatClick: (n: number) => void }) => (
  <div className="inline-flex flex-col gap-0.5">
    {seats.map((row, i) => (
      <div key={i} className="flex gap-0.5">
        {row.map(n => (
          <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" />
        ))}
      </div>
    ))}
  </div>
);

export const Floor4SeatMap = ({ statuses, onSeatClick }: Props) => {
  // Left top section (145-152, 195-218)
  const leftTopGroups = [
    { seats: [[145], [146]] },
    { seats: [[207, 206], [208, 205], [209, 204], [210, 203], [211, 202], [212, 201]] },
    { seats: [[147], [148]] },
  ];

  const leftMiddleGroups = [
    { seats: [[149], [150]] },
    { seats: [[213, 200], [214, 199], [215, 198], [216, 197], [217, 196], [218, 195]] },
    { seats: [[152]] },
  ];

  // Center/right groups
  const rightGroups = [
    { seats: [[1, 2, 3, 4, 5, 6], [12, 11, 10, 9, 8, 7]] },
    { seats: [[13, 14, 15, 16, 17, 18], [24, 23, 22, 21, 20, 19]] },
    { seats: [[25, 26, 27, 28, 29, 30], [36, 35, 34, 33, 32, 31]] },
    { seats: [[37, 38, 39, 40, 41, 42], [48, 47, 46, 45, 44, 43]] },
    { seats: [[49, 50, 51, 52, 53, 54], [60, 59, 58, 57, 56, 55]] },
    { seats: [[61, 62, 63, 64, 65, 66], [72, 71, 70, 69, 68, 67]] },
    { seats: [[73, 74, 75, 76, 77, 78], [84, 83, 82, 81, 80, 79]] },
    { seats: [[85, 86, 87, 88, 89, 90], [95, 94, 93, 92, 91]] },
    { seats: [[97, 98, 99, 100, 101, 102], [108, 107, 106, 105, 104, 103]] },
  ];

  // Left bottom groups
  const leftBottomGroups = [
    { seats: [[127, 128, 129, 130, 131], [126, 125, 124, 123, 122]] },
    { seats: [[115, 116, 117, 118, 119], [114, 113, 112, 111, 110]] },
    { seats: [[183, 184, 185, 186, 187, 188], [182, 181, 180, 179, 178, 177]] },
  ];

  // Bottom right
  const bottomRightGroups = [
    { seats: [[189, 190, 191, 192, 193, 194], [176, 175, 174, 173, 172, 171]] },
  ];

  // Single seats column (153-170)
  const singleSeats = Array.from({ length: 18 }, (_, i) => 153 + i);

  // Special numbers (133-144)
  const specialSeats = [144, 143, 142, 141, 140, 139, 138, 137, 136, 135, 134, 133];

  return (
    <div className="overflow-auto p-4">
      <div className="min-w-[700px]">
        <div className="flex gap-8">
          {/* Left Section */}
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">좌측 구역</div>
            {/* Top left desks */}
            <div className="flex gap-2 items-start">
              <div className="flex flex-col gap-0.5">
                {[145, 146, 147, 148].map(n => (
                  <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" />
                ))}
              </div>
              <SeatBlock seats={[[207, 206], [208, 205], [209, 204], [210, 203], [211, 202], [212, 201]]} statuses={statuses} onSeatClick={onSeatClick} />
              <div className="flex flex-col gap-0.5">
                {specialSeats.slice(0, 6).map(n => (
                  <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" />
                ))}
              </div>
            </div>

            {/* Middle left */}
            <div className="flex gap-2 items-start">
              <div className="flex flex-col gap-0.5">
                {[149, 150, 151, 152].map(n => (
                  <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" />
                ))}
              </div>
              <SeatBlock seats={[[213, 200], [214, 199], [215, 198], [216, 197], [217, 196], [218, 195]]} statuses={statuses} onSeatClick={onSeatClick} />
              <div className="flex flex-col gap-0.5">
                {specialSeats.slice(6).map(n => (
                  <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" />
                ))}
              </div>
            </div>

            {/* Bottom left */}
            <div className="mt-4 flex flex-col gap-3">
              {leftBottomGroups.map((group, i) => (
                <SeatBlock key={i} seats={group.seats} statuses={statuses} onSeatClick={onSeatClick} />
              ))}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">우측 구역</div>
            {rightGroups.map((group, i) => (
              <SeatBlock key={i} seats={group.seats} statuses={statuses} onSeatClick={onSeatClick} />
            ))}
            <div className="mt-2">
              {bottomRightGroups.map((group, i) => (
                <SeatBlock key={i} seats={group.seats} statuses={statuses} onSeatClick={onSeatClick} />
              ))}
            </div>
          </div>

          {/* Single seats column */}
          <div className="flex flex-col gap-0.5">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">개인석</div>
            {singleSeats.map(n => (
              <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" />
            ))}
          </div>
        </div>

        {/* Free seating area */}
        <div className="mt-6 border-2 border-dashed border-border rounded-lg p-4 text-center">
          <span className="text-sm font-display text-muted-foreground">자율좌석구역 (non-issue seats)</span>
        </div>
      </div>
    </div>
  );
};

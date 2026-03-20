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

const SingleColumn = ({ seats, statuses, onSeatClick, selectedSeats }: { seats: number[]; statuses: Record<number, SeatStatus>; onSeatClick: (n: number) => void; selectedSeats?: Set<number> }) => (
  <div className="flex flex-col gap-0.5">
    {seats.map(n => (
      <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" selected={selectedSeats?.has(n)} />
    ))}
  </div>
);

export const Floor4SeatMap = ({ statuses, onSeatClick, selectedSeats }: Props) => {
  return (
    <div className="overflow-auto p-4">
      <div className="min-w-[750px]">
        <div className="flex gap-8">
          {/* Left Section */}
          <div className="flex flex-col gap-6">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">좌측 구역</div>

            {/* Upper left block: 145-146, 207-212/206-201, 144-139 */}
            <div className="flex gap-2 items-start">
              <SingleColumn seats={[145, 146]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
              <SeatBlock
                seats={[
                  [207, 206],
                  [208, 205],
                  [209, 204],
                  [210, 203],
                  [211, 202],
                  [212, 201],
                ]}
                statuses={statuses}
                onSeatClick={onSeatClick}
                selectedSeats={selectedSeats}
              />
              <SingleColumn seats={[144, 143, 142, 141, 140, 139]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            </div>

            {/* 147,148 below */}
            <div className="flex gap-2 items-start -mt-4">
              <SingleColumn seats={[147, 148]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            </div>

            {/* Lower left block: 149-150, 213-218/200-195, 138-133 */}
            <div className="flex gap-2 items-start">
              <SingleColumn seats={[149, 150]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
              <SeatBlock
                seats={[
                  [213, 200],
                  [214, 199],
                  [215, 198],
                  [216, 197],
                  [217, 196],
                  [218, 195],
                ]}
                statuses={statuses}
                onSeatClick={onSeatClick}
                selectedSeats={selectedSeats}
              />
              <SingleColumn seats={[138, 137, 136, 135, 134, 133]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            </div>

            <div className="flex gap-2 items-start -mt-4">
              <SingleColumn seats={[151, 152]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            </div>

            {/* Bottom left groups */}
            <div className="flex flex-col gap-3 mt-4">
              <SeatBlock seats={[[127, 128, 129, 130, 131, 132], [126, 125, 124, 123, 122, 121]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
              <SeatBlock seats={[[115, 116, 117, 118, 119, 120], [114, 113, 112, 111, 110, 109]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
              <SeatBlock seats={[[183, 184, 185, 186, 187, 188], [182, 181, 180, 179, 178, 177]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            </div>
          </div>

          {/* Center-Right Section */}
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">우측 구역</div>
            <SeatBlock seats={[[1, 2, 3, 4, 5, 6], [12, 11, 10, 9, 8, 7]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <SeatBlock seats={[[13, 14, 15, 16, 17, 18], [24, 23, 22, 21, 20, 19]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <SeatBlock seats={[[25, 26, 27, 28, 29, 30], [36, 35, 34, 33, 32, 31]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <SeatBlock seats={[[37, 38, 39, 40, 41, 42], [48, 47, 46, 45, 44, 43]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <SeatBlock seats={[[49, 50, 51, 52, 53, 54], [60, 59, 58, 57, 56, 55]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <SeatBlock seats={[[61, 62, 63, 64, 65, 66], [72, 71, 70, 69, 68, 67]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />

            <div className="mt-4">
              <SeatBlock seats={[[73, 74, 75, 76, 77, 78], [84, 83, 82, 81, 80, 79]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            </div>
            <SeatBlock seats={[[85, 86, 87, 88, 89, 90], [96, 95, 94, 93, 92, 91]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <SeatBlock seats={[[97, 98, 99, 100, 101, 102], [108, 107, 106, 105, 104, 103]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />

            <div className="mt-4">
              <SeatBlock seats={[[189, 190, 191, 192, 193, 194], [176, 175, 174, 173, 172, 171]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            </div>
          </div>

          {/* Individual seats column (153~170) */}
          <div className="flex flex-col gap-0.5">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">개인석</div>
            {Array.from({ length: 18 }, (_, i) => 153 + i).map(n => (
              <SeatCell key={n} number={n} status={statuses[n] || 'available'} onClick={() => onSeatClick(n)} size="sm" selected={selectedSeats?.has(n)} />
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

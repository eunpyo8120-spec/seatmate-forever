import { SeatCell } from './SeatCell';
import type { SeatStatus } from '@/types/seat';

interface Props {
  statuses: Record<number, SeatStatus>;
  onSeatClick: (num: number) => void;
  selectedSeats?: Set<number>;
}

// Internal mapping: N1-N27 → 101-127, C1-C6 → 201-206, regular → 1-83
const nLabel = (n: number) => `N${n - 100}`;
const cLabel = (n: number) => `C${n - 200}`;

const Cell = ({ id, statuses, onSeatClick, selectedSeats, label }: { id: number; statuses: Record<number, SeatStatus>; onSeatClick: (n: number) => void; selectedSeats?: Set<number>; label?: string }) => (
  <SeatCell number={id} label={label} status={statuses[id] || 'available'} onClick={() => onSeatClick(id)} size="sm" selected={selectedSeats?.has(id)} />
);

const NGroup = ({ ids, statuses, onSeatClick, selectedSeats }: { ids: [number, number, number, number]; statuses: Record<number, SeatStatus>; onSeatClick: (n: number) => void; selectedSeats?: Set<number> }) => (
  <div className="flex gap-1 items-center border border-border rounded-md p-1.5">
    <div className="flex flex-col gap-0.5">
      <div className="flex gap-0.5">
        <Cell id={ids[0]} label={nLabel(ids[0])} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
        <Cell id={ids[1]} label={nLabel(ids[1])} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
      </div>
      <div className="flex gap-0.5">
        <Cell id={ids[2]} label={nLabel(ids[2])} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
        <Cell id={ids[3]} label={nLabel(ids[3])} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
      </div>
    </div>
  </div>
);

const SeatBlock = ({ seats, statuses, onSeatClick, selectedSeats }: { seats: number[][]; statuses: Record<number, SeatStatus>; onSeatClick: (n: number) => void; selectedSeats?: Set<number> }) => (
  <div className="inline-flex flex-col gap-0.5">
    {seats.map((row, i) => (
      <div key={i} className="flex gap-0.5">
        {row.map(n => (
          <Cell key={n} id={n} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
        ))}
      </div>
    ))}
  </div>
);

export const Floor4NSeatMap = ({ statuses, onSeatClick, selectedSeats }: Props) => {
  return (
    <div className="overflow-auto p-4">
      <div className="min-w-[700px]">
        <div className="flex gap-6">
          {/* Left: N-seat groups */}
          <div className="flex flex-col gap-6">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">그룹스터디룸</div>
            <NGroup ids={[123, 127, 122, 125]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <NGroup ids={[119, 120, 118, 117]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <NGroup ids={[114, 115, 113, 112]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <NGroup ids={[109, 110, 108, 107]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            <NGroup ids={[104, 105, 103, 102]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
          </div>

          {/* Center-left: regular seat blocks */}
          <div className="flex flex-col gap-6">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">일반석</div>
            {/* 26,27,28 / 37,36,35 */}
            <SeatBlock seats={[[26, 27, 28], [37, 36, 35]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 61,60 */}
            <SeatBlock seats={[[61, 60]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 62,59 / 63,58 / 64,57 / 65,56 */}
            <SeatBlock seats={[[62, 59], [63, 58], [64, 57], [65, 56]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 72,73,74 / 83,82,81 */}
            <SeatBlock seats={[[72, 73, 74], [83, 82, 81]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
          </div>

          {/* Center-right: regular seat blocks */}
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">&nbsp;</div>
            {/* Top row: 25,24,23,22,21,20 */}
            <SeatBlock seats={[[25, 24, 23, 22, 21, 20]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 29,30,31 / 34,33,32 */}
            <SeatBlock seats={[[29, 30, 31], [34, 33, 32]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 38,39,40 / 43,42,41 */}
            <SeatBlock seats={[[38, 39, 40], [43, 42, 41]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 44,45,46 / 49,48,47 */}
            <SeatBlock seats={[[44, 45, 46], [49, 48, 47]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 50,51,52 / 55,54,53 */}
            <SeatBlock seats={[[50, 51, 52], [55, 54, 53]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 66,67,68 / 71,70,69 */}
            <SeatBlock seats={[[66, 67, 68], [71, 70, 69]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            {/* 75,76,77 / 80,79,78 */}
            <SeatBlock seats={[[75, 76, 77], [80, 79, 78]]} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
          </div>

          {/* Right: single column 19~7 */}
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-display font-semibold text-muted-foreground mb-1">벽면석</div>
            {[19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7].map(n => (
              <Cell key={n} id={n} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
            ))}
          </div>
        </div>

        {/* Bottom: C seats (컴퓨터석) */}
        <div className="mt-6 flex gap-2">
          {[201, 202, 203, 204, 205, 206].map(n => (
            <Cell key={n} id={n} label={cLabel(n)} statuses={statuses} onSeatClick={onSeatClick} selectedSeats={selectedSeats} />
          ))}
        </div>
      </div>
    </div>
  );
};

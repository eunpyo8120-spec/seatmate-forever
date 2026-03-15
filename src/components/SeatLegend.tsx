export const SeatLegend = () => (
  <div className="flex items-center gap-4 text-xs font-body text-muted-foreground flex-wrap">
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-3 rounded-sm bg-primary" />
      <span>사용가능</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-3 rounded-sm bg-occupied" />
      <span>사용중</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-3 rounded-sm bg-available" />
      <span>내 좌석</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-3 rounded-sm bg-destructive" />
      <span>사석화 경고</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-3 rounded-sm bg-muted opacity-50" />
      <span>사용불가</span>
    </div>
  </div>
);

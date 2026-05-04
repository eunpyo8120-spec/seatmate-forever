/** Convert internal seat ID to display label */
export const getSeatLabel = (seatNumber: number): string => {
  if (seatNumber >= 201 && seatNumber <= 206) return `C${seatNumber - 200}`;
  if (seatNumber >= 101 && seatNumber <= 127) return `N${seatNumber - 100}`;
  return String(seatNumber);
};

/** Convert floor key to display name */
export const getFloorName = (floor: string): string => {
  if (floor === '2') return '2층 1열람실';
  if (floor === '4') return '4층 2열람실';
  if (floor === '4N') return '4층 노상일열람실';
  if (floor === 'TEST') return '테스트 열람실 (N구역)';
  return `${floor}층 열람실`;
};

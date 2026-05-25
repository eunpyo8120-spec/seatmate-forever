export type SeatStatus = 'available' | 'occupied' | 'mine' | 'disabled' | 'warning' | 'ghost' | 'reserved' | 'managed' | 'lost_item' | 'unauthorized';

export interface Seat {
  id: number;
  status: SeatStatus;
  isAccessible?: boolean;
}

export interface SeatGroup {
  seats: number[];
  row: number;
  col: number;
}

export interface Notification {
  id: string;
  type: 'confirmed' | 'warning' | 'expired' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

import { create } from 'zustand';
import type { SeatStatus, Notification } from '@/types/seat';

interface AppState {
  isLoggedIn: boolean;
  userName: string;
  studentId: string;
  isAdmin: boolean;
  mySeat: { floor: string; seatNumber: number; startTime: Date; endTime: Date } | null;
  seatStatuses: Record<string, Record<number, SeatStatus>>;
  notifications: Notification[];
  login: (studentId: string, name: string, isAdmin: boolean) => void;
  logout: () => void;
  setSeatStatuses: (statuses: Record<string, Record<number, SeatStatus>>) => void;
  setMySeat: (seat: AppState['mySeat']) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
}

const generateSeatStatuses = (seatIds: number[]): Record<number, SeatStatus> => {
  const statuses: Record<number, SeatStatus> = {};
  seatIds.forEach(id => {
    statuses[id] = 'available';
  });
  return statuses;
};

const floor2Seats = Array.from({ length: 324 }, (_, i) => i + 1);
const floor4Seats = Array.from({ length: 218 }, (_, i) => i + 1);
const floor4NSeats = [
  ...Array.from({ length: 77 }, (_, i) => i + 7),
  ...Array.from({ length: 27 }, (_, i) => i + 101),
  ...Array.from({ length: 6 }, (_, i) => i + 201),
];
const floorTestSeats = [122, 123, 125, 127];

const initialNotifications: Notification[] = [
  { id: '1', type: 'info', title: '공지사항', message: '도서관 이용시간이 변경되었습니다. (09:00 ~ 22:00)', time: '10분 전', read: false },
  { id: '2', type: 'warning', title: '사석화 경고', message: '30분 이상 자리를 비우면 자동으로 퇴실 처리됩니다.', time: '1시간 전', read: false },
  { id: '3', type: 'confirmed', title: '좌석 배정 완료', message: '2층 1열람실 42번 좌석이 배정되었습니다.', time: '2시간 전', read: true },
];

export const useAppStore = create<AppState>((set) => ({
  isLoggedIn: false,
  userName: '',
  studentId: '',
  isAdmin: false,
  mySeat: null,
  seatStatuses: {
    '2': generateSeatStatuses(floor2Seats),
    '4': generateSeatStatuses(floor4Seats),
    '4N': generateSeatStatuses(floor4NSeats),
    'TEST': generateSeatStatuses(floorTestSeats),
  },
  notifications: initialNotifications,
  login: (studentId, name, isAdmin) => set({ isLoggedIn: true, studentId, userName: name, isAdmin }),
  logout: () => set({ isLoggedIn: false, userName: '', studentId: '', isAdmin: false, mySeat: null }),
  setSeatStatuses: (statuses) => set({ seatStatuses: statuses }),
  setMySeat: (seat) => set({ mySeat: seat }),
  addNotification: (notification) => set(state => ({
    notifications: [notification, ...state.notifications],
  })),
  markNotificationRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  },
}));

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
  setNotifications: (notifications: Notification[]) => void;
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
  notifications: [],
  login: (studentId, name, isAdmin) => set({ isLoggedIn: true, studentId, userName: name, isAdmin }),
  logout: () => set({ isLoggedIn: false, userName: '', studentId: '', isAdmin: false, mySeat: null }),
  setSeatStatuses: (statuses) => set({ seatStatuses: statuses }),
  setMySeat: (seat) => set({ mySeat: seat }),
  setNotifications: (notifications) => set({ notifications }),
  markNotificationRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  },
}));

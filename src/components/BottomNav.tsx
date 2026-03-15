import { Home, MapPin, User, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';

const navItems = [
  { path: '/main', icon: Home, label: '홈' },
  { path: '/seats', icon: MapPin, label: '좌석현황' },
  { path: '/my-seat', icon: User, label: '내 좌석' },
  { path: '/notifications', icon: Bell, label: '알림' },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useAppStore(s => s.notifications.filter(n => !n.read).length);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || (path === '/seats' && location.pathname.startsWith('/seats'));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-4 py-2 transition-colors relative',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-display font-medium">{label}</span>
              {label === '알림' && unreadCount > 0 && (
                <span className="absolute -top-0.5 right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

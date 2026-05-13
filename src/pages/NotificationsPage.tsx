import { useAppStore } from '@/store/appStore';
import { useNotifications } from '@/hooks/useNotifications';
import { BottomNav } from '@/components/BottomNav';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap = {
  confirmed: CheckCircle,
  warning: AlertTriangle,
  expired: XCircle,
  info: Info,
};

const iconColorMap = {
  confirmed: 'text-available',
  warning: 'text-destructive',
  expired: 'text-muted-foreground',
  info: 'text-primary',
};

const NotificationsPage = () => {
  const { loading } = useNotifications();
  const { notifications, markNotificationRead } = useAppStore();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-5 py-4">
        <h1 className="font-display font-bold text-lg text-foreground">알림</h1>
      </div>

      <div className="divide-y divide-border">
        {loading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground font-body">불러오는 중...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground font-body">알림이 없습니다</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = iconMap[n.type];
            return (
              <button
                key={n.id}
                className={cn(
                  'w-full flex items-start gap-3 px-5 py-4 text-left transition-colors',
                  !n.read ? 'bg-primary/5' : 'bg-card'
                )}
                onClick={() => markNotificationRead(n.id)}
              >
                <div className={cn('mt-0.5', iconColorMap[n.type])}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-display font-semibold', !n.read ? 'text-foreground' : 'text-muted-foreground')}>
                      {n.title}
                    </p>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm font-body text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs font-body text-muted-foreground/60 mt-1">{n.time}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default NotificationsPage;

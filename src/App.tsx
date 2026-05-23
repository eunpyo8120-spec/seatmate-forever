import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import SeatsPage from "./pages/SeatsPage";
import MySeatPage from "./pages/MySeatPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";
import { useAuth, useAuthContext, AuthContext } from "./hooks/useAuth";
import { useReservations } from "./hooks/useReservations";
import { useSeats, SeatsContext } from "./hooks/useSeats";
import { useAppStore } from "./store/appStore";

const queryClient = new QueryClient();

// 앱 전체에서 auth 상태를 한 번만 구독 — 페이지 전환 시 재구독 없음
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// 앱 전체에서 예약 구독을 한 번만 — 페이지 전환 시 재구독 없음
const ReservationSync = ({ children }: { children: React.ReactNode }) => {
  useReservations();
  return <>{children}</>;
};

// 앱 전체에서 seats 데이터를 한 번만 fetch — 페이지 전환 시 재fetch 없음
const SeatsProvider = ({ children }: { children: React.ReactNode }) => {
  const seatsData = useSeats();
  return <SeatsContext.Provider value={seatsData}>{children}</SeatsContext.Provider>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthContext();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩중...</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthContext();
  const isAdmin = useAppStore(s => s.isAdmin);
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩중...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/main" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthContext();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩중...</div>;
  if (user) return <Navigate to="/main" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <SeatsProvider>
            <ReservationSync>
              <Routes>
                <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/main" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
                <Route path="/seats" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
                <Route path="/seats/:floor" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
                <Route path="/my-seat" element={<ProtectedRoute><MySeatPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ReservationSync>
          </SeatsProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

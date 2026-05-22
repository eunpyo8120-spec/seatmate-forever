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
import AdminCalibratePage from "./pages/AdminCalibratePage";
import NotFound from "./pages/NotFound";
import { useAuth, useAuthContext, AuthContext } from "./hooks/useAuth";
import { useReservations } from "./hooks/useReservations";
import { useAppStore } from "./store/appStore";

const queryClient = new QueryClient();

// 앱 전체에서 auth 상태를 한 번만 구독 — 페이지 전환 시 재구독 없음
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

const ReservationSync = ({ children }: { children: React.ReactNode }) => {
  useReservations();
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthContext();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩중...</div>;
  if (!user) return <Navigate to="/" replace />;
  return <ReservationSync>{children}</ReservationSync>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthContext();
  const isAdmin = useAppStore(s => s.isAdmin);
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩중...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/main" replace />;
  return <ReservationSync>{children}</ReservationSync>;
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
          <Routes>
            <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/main" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
            <Route path="/seats" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
            <Route path="/seats/:floor" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
            <Route path="/my-seat" element={<ProtectedRoute><MySeatPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/admin/calibrate" element={<AdminRoute><AdminCalibratePage /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

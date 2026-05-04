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
import { useAuth } from "./hooks/useAuth";
import { useReservations } from "./hooks/useReservations";

const queryClient = new QueryClient();

const ReservationSync = ({ children }: { children: React.ReactNode }) => {
  useReservations();
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩중...</div>;
  if (!user) return <Navigate to="/" replace />;
  return <ReservationSync>{children}</ReservationSync>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩중...</div>;
  if (user) return <Navigate to="/main" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/main" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
          <Route path="/seats" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
          <Route path="/seats/:floor" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
          <Route path="/my-seat" element={<ProtectedRoute><MySeatPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin/calibrate" element={<ProtectedRoute><AdminCalibratePage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

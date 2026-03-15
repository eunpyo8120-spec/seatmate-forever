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
import { useAppStore } from "./store/appStore";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isLoggedIn = useAppStore(s => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/main" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
          <Route path="/seats" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
          <Route path="/seats/:floor" element={<ProtectedRoute><SeatsPage /></ProtectedRoute>} />
          <Route path="/my-seat" element={<ProtectedRoute><MySeatPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

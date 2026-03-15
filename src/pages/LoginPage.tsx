import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { BookOpen, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

const LoginPage = () => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const login = useAppStore(s => s.login);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId.trim()) {
      login(studentId, `학생_${studentId.slice(-4)}`);
      navigate('/main');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">도서관 좌석 관리</h1>
          <p className="text-sm font-body text-muted-foreground mt-1">학번으로 로그인하세요</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-xl p-6 shadow-sm border border-border space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-display font-medium text-foreground">학번</label>
            <Input
              type="text"
              placeholder="20241234"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-display font-medium text-foreground">비밀번호</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-11"
              required
            />
          </div>
          <Button type="submit" className="w-full h-11 font-display font-semibold">
            <LogIn className="w-4 h-4 mr-2" />
            로그인
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginPage;

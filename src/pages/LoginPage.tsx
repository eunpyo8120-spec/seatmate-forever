import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { BookOpen, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const ALLOWED_IDS: Record<string, { name: string; isAdmin: boolean }> = {
  '2021099698': { name: '학생_9698', isAdmin: false },
  '2021026953': { name: '학생_6953', isAdmin: false },
  '2021005632': { name: '학생_5632', isAdmin: false },
  '2026': { name: '관리자', isAdmin: true },
};

const LoginPage = () => {
  const [studentId, setStudentId] = useState('');
  const login = useAppStore(s => s.login);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = ALLOWED_IDS[studentId.trim()];
    if (user) {
      login(studentId.trim(), user.name, user.isAdmin);
      navigate('/main');
    } else {
      toast.error('등록되지 않은 학번입니다.');
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
          <h1 className="text-2xl font-display font-bold text-foreground">한양대에리카</h1>
          <h2 className="text-lg font-display font-semibold text-foreground mt-1">도서관 좌석관리</h2>
          <p className="text-sm font-body text-muted-foreground mt-1">학번을 입력하여 로그인하세요</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-xl p-6 shadow-sm border border-border space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-display font-medium text-foreground">학번</label>
            <Input
              type="text"
              placeholder="학번을 입력하세요"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
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

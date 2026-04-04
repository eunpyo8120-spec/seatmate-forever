import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const EMAIL_DOMAIN = '@hanyang.ac.kr';

const LoginPage = () => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const toEmail = (id: string) => `${id.trim()}${EMAIL_DOMAIN}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = studentId.trim();

    if (trimmedId.length < 4) {
      toast.error('학번을 올바르게 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: toEmail(trimmedId),
          password,
          options: {
            data: { student_id: trimmedId },
          },
        });
        if (error) throw error;
        toast.success('회원가입이 완료되었습니다!');
        navigate('/main');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: toEmail(trimmedId),
          password,
        });
        if (error) throw error;
        navigate('/main');
      }
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        toast.error('학번 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message?.includes('User already registered')) {
        toast.error('이미 등록된 학번입니다.');
      } else {
        toast.error(err.message || '오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-display font-bold text-foreground">한양대 에리카</h1>
          <h2 className="text-lg font-display font-semibold text-foreground mt-1">도서관 좌석관리</h2>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-display">
              {isSignUp ? '회원가입' : '로그인'}
            </CardTitle>
            <CardDescription className="font-body">
              {isSignUp
                ? '학번과 비밀번호를 입력하여 계정을 만드세요'
                : '학번과 비밀번호를 입력하여 로그인하세요'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-display font-medium text-foreground">학번</label>
                <Input
                  type="text"
                  placeholder="학번을 입력하세요 (예: 2021099698)"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  className="h-11"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-display font-medium text-foreground">비밀번호</label>
                <Input
                  type="password"
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-11"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full h-11 font-display font-semibold" disabled={loading}>
                {loading ? (
                  <span className="animate-pulse">처리중...</span>
                ) : isSignUp ? (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    회원가입
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    로그인
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-body text-primary hover:underline"
              >
                {isSignUp
                  ? '이미 계정이 있으신가요? 로그인'
                  : '아직 계정이 없으신가요? 회원가입'}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;

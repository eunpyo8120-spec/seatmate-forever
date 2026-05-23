import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuthContext = () => useContext(AuthContext);

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const login = useAppStore(s => s.login);
  const logout = useAppStore(s => s.logout);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount — getSession 중복 불필요
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        // ID 동일하면 레퍼런스 교체 방지 — TOKEN_REFRESHED 등으로 인한 불필요한 리렌더 차단
        setUser(prev => (prev?.id === u?.id ? prev : u));
        if (u) {
          const studentId = u.user_metadata?.student_id || '';
          const isAdmin = studentId.startsWith('9999');
          supabase.from('profiles').select('display_name').eq('student_id', studentId).single()
            .then(({ data }) => {
              const name = data?.display_name || studentId;
              login(studentId, name, isAdmin);
              setLoading(false);
            });
        } else {
          logout();
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [login, logout]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    logout();
  }, [logout]);

  return { user, loading, signOut };
};

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import type { User } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const login = useAppStore(s => s.login);
  const logout = useAppStore(s => s.logout);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          const studentId = u.user_metadata?.student_id || '';
          const isAdmin = studentId.startsWith('9999');
          supabase.from('profiles').select('full_name, display_name').eq('id', u.id).single()
            .then(({ data }) => {
              const name = data?.display_name || data?.full_name || studentId;
              login(studentId, name, isAdmin);
            });
        } else {
          logout();
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const studentId = u.user_metadata?.student_id || '';
        const isAdmin = studentId.startsWith('9999');
        supabase.from('profiles').select('full_name, display_name').eq('id', u.id).single()
          .then(({ data }) => {
            const name = data?.display_name || data?.full_name || studentId;
            login(studentId, name, isAdmin);
          });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    logout();
  };

  return { user, loading, signOut };
};

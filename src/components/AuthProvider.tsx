'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  role: 'admin' | 'teacher' | 'student';
  student_id: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as UserProfile);
    else setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.id);
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          await fetchProfile(nextUser.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 경로 접근 제어 (미로그인 및 권한별 리다이렉트)
  useEffect(() => {
    if (loading) return;

    const isPublic = pathname.startsWith('/login') || pathname.startsWith('/report');

    // 로그인 안 된 상태에서 비공개 페이지 접근 시 로그인 페이지로 이동
    if (!user && !isPublic) {
      router.replace('/login');
      return;
    }

    // 로그인 된 상태에서 권한별 페이지 제어
    if (user && profile) {
      if (pathname.startsWith('/login')) {
        router.replace(profile.role === 'student' ? '/my-report' : '/');
        return;
      }
      if (profile.role === 'student' && !pathname.startsWith('/my-report') && !pathname.startsWith('/report')) {
        router.replace('/my-report');
        return;
      }
      if (profile.role === 'teacher' && pathname.startsWith('/admin')) {
        router.replace('/');
        return;
      }
    }
  }, [user, profile, loading, pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.replace('/login');
  };

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/report');
  if (loading && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117] text-gray-400 text-sm">
        인증 정보를 확인하는 중...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, UserProfile } from '@/components/AuthProvider';
import { ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';

interface StudentOption {
  id: string;
  name: string;
  school?: string | null;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: profileData }, { data: studentData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('id, name, school').order('name', { ascending: true }),
    ]);

    if (profileData) setUsers(profileData as UserProfile[]);
    if (studentData) setStudents(studentData as StudentOption[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateUser = async (
    userId: string,
    updates: Partial<Pick<UserProfile, 'role' | 'student_id'>>
  ) => {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates } : u))
    );
    setSavedId(userId);
    setTimeout(() => setSavedId(null), 1500);
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="text-sm text-gray-400 p-8">관리자만 접근할 수 있는 페이지입니다.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldCheck className="text-blue-400" size={24} />
            관리자 · 계정관리
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            가입된 계정의 권한(관리자/강사/학생)을 설정하고, 학생 계정을 명단과 연결합니다.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#161922] border border-gray-800 hover:border-gray-700 rounded-lg text-xs text-gray-300 transition"
        >
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      <div className="bg-[#161922] border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">계정 목록을 불러오는 중...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">가입된 계정이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400 bg-[#0f1117]/60">
                  <th className="py-3.5 px-4 font-medium">이름</th>
                  <th className="py-3.5 px-4 font-medium">이메일</th>
                  <th className="py-3.5 px-4 font-medium">권한 (Role)</th>
                  <th className="py-3.5 px-4 font-medium">연결된 학생 (학생 계정용)</th>
                  <th className="py-3.5 px-4 font-medium w-24 text-center">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/70 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-800/20 transition">
                    <td className="py-3.5 px-4 font-medium text-white">
                      {u.name || '이름 없음'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleUpdateUser(u.id, {
                            role: e.target.value as UserProfile['role'],
                          })
                        }
                        className="bg-[#0f1117] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="student">학생 · 학부모</option>
                        <option value="teacher">강사</option>
                        <option value="admin">최고 관리자</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.role === 'student' ? (
                        <select
                          value={u.student_id || ''}
                          onChange={(e) =>
                            handleUpdateUser(u.id, {
                              student_id: e.target.value || null,
                            })
                          }
                          className="bg-[#0f1117] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 min-w-[180px]"
                        >
                          <option value="">-- 학생 선택 (미연결) --</option>
                          {students.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name} {st.school ? `(${st.school})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-500">해당 없음</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {savedId === u.id && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 size={14} /> 저장됨
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
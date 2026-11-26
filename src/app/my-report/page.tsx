'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Award, TrendingUp, AlertCircle, FileCheck2 } from 'lucide-react';

interface ExamResultRow {
  id: string;
  score: number;
  wrong_numbers: number[] | null;
  created_at: string;
  exams: {
    id: string;
    title: string;
    total_questions: number | null;
  } | null;
}

export default function MyReportPage() {
  const { profile } = useAuth();
  const [studentName, setStudentName] = useState<string>('');
  const [results, setResults] = useState<ExamResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMyReport = async () => {
      if (!profile?.student_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data: stData }, { data: resData }] = await Promise.all([
        supabase
          .from('students')
          .select('name')
          .eq('id', profile.student_id)
          .single(),
        supabase
          .from('exam_results')
          .select('id, score, wrong_numbers, created_at, exams(id, title, total_questions)')
          .eq('student_id', profile.student_id)
          .order('created_at', { ascending: true }),
      ]);

      if (stData?.name) setStudentName(stData.name);
      if (resData) setResults(resData as unknown as ExamResultRow[]);
      setLoading(false);
    };

    loadMyReport();
  }, [profile?.student_id]);

  if (loading) {
    return <div className="text-sm text-gray-400 p-8">누적 성적표를 불러오는 중...</div>;
  }

  if (!profile?.student_id) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-[#161922] border border-gray-800 rounded-2xl p-8 text-center space-y-3">
        <AlertCircle className="mx-auto text-amber-400" size={36} />
        <h2 className="text-lg font-bold text-white">학생 정보 연결 대기 중</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          아직 계정이 학생 명단과 연결되지 않았습니다.<br />
          학원 관리자에게 계정 연결을 요청해 주세요.
        </p>
      </div>
    );
  }

  const totalExams = results.length;
  const avgScore =
    totalExams > 0
      ? Math.round((results.reduce((sum, r) => sum + Number(r.score || 0), 0) / totalExams) * 10) / 10
      : 0;
  const maxScore =
    totalExams > 0 ? Math.max(...results.map((r) => Number(r.score || 0))) : 0;
  const latestScore = totalExams > 0 ? Number(results[results.length - 1].score || 0) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Award className="text-blue-400" size={24} />
          {studentName || profile.name} 학생 누적 성적표
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          지금까지 응시한 모든 시험의 점수 추이와 오답 기록을 확인할 수 있습니다.
        </p>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400">총 응시 횟수</div>
          <div className="text-2xl font-bold text-white mt-1">{totalExams}회</div>
        </div>
        <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400">누적 평균 점수</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{avgScore}점</div>
        </div>
        <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400">최고 점수</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{maxScore}점</div>
        </div>
        <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400">최근 시험 점수</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{latestScore}점</div>
        </div>
      </div>

      {/* 점수 추이 그래프 */}
      {totalExams > 0 && (
        <div className="bg-[#161922] border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-blue-400" />
            회차별 점수 추이
          </h2>
          <div className="flex items-end gap-4 h-44 pt-4 overflow-x-auto">
            {results.map((r, idx) => {
              const score = Math.min(100, Math.max(0, Number(r.score || 0)));
              return (
                <div key={r.id} className="flex flex-col items-center min-w-[64px] h-full justify-end">
                  <span className="text-xs font-bold text-blue-300 mb-1.5">{score}점</span>
                  <div className="w-10 bg-gray-800/80 rounded-t-md h-28 flex items-end overflow-hidden">
                    <div
                      className="w-full bg-blue-500 rounded-t-md transition-all"
                      style={{ height: `${score}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 mt-2 truncate max-w-[72px]" title={r.exams?.title}>
                    {r.exams?.title || `${idx + 1}회차`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 상세 시험 기록 목록 */}
      <div className="bg-[#161922] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <FileCheck2 size={16} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-white">시험별 상세 기록</h2>
        </div>
        {totalExams === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            아직 채점된 시험 기록이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-800/70">
            {[...results].reverse().map((r) => {
              const wrongs = Array.isArray(r.wrong_numbers) ? r.wrong_numbers : [];
              const dateStr = new Date(r.created_at).toLocaleDateString('ko-KR');
              return (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {r.exams?.title || '시험명 없음'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{dateStr}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-gray-400">
                      오답:{' '}
                      {wrongs.length > 0 ? (
                        <span className="text-rose-400 font-medium">
                          {wrongs.join(', ')}번
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-medium">만점!</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-blue-400 min-w-[54px] text-right">
                      {r.score}점
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
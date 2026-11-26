'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import {
  BookOpen,
  Users,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Award,
  UserX,
} from 'lucide-react';

interface ClassRow {
  id: string;
  name: string;
}

interface StudentRow {
  id: string;
  name: string;
  school?: string | null;
}

interface QuestionItem {
  num: number;
  answer?: string;
  unit?: string;
  score?: number;
}

interface ExamRow {
  id: string;
  title: string;
  class_id: string | null;
  questions: QuestionItem[] | null;
  created_at: string;
}

interface ResultRow {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  wrong_numbers: number[] | null;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 하단 오답률 분석 대상 시험 ID
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // 팝업 상태들
  const [showGradedModal, setShowGradedModal] = useState(false);
  const [modalExamId, setModalExamId] = useState<string | null>(null);
  const [selectedQuestionNum, setSelectedQuestionNum] = useState<number | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);

      let clsQuery = supabase.from('classes').select('id, name');
      let exmQuery = supabase
        .from('exams')
        .select('id, title, class_id, questions, created_at')
        .order('created_at', { ascending: false });

      if (profile?.role === 'teacher') {
        clsQuery = clsQuery.eq('teacher_id', profile.id);
        exmQuery = exmQuery.eq('teacher_id', profile.id);
      }

     let stuQuery = supabase.from('students').select('id, name, school');
      if (profile?.role === 'teacher') {
        stuQuery = stuQuery.eq('teacher_id', profile.id);
      }

      const [clsRes, stuRes, exmRes, resRes] = await Promise.all([
        clsQuery,
        stuQuery,
        exmQuery,
        supabase
          .from('exam_results')
          .select('id, exam_id, student_id, score, wrong_numbers, created_at')
          .order('created_at', { ascending: false }),
      ]);

      const clsList = (clsRes.data || []) as ClassRow[];
      const stuList = (stuRes.data || []) as StudentRow[];
      const exmList = (exmRes.data || []) as ExamRow[];
      const allResults = (resRes.data || []) as ResultRow[];

      const examIdSet = new Set(exmList.map((e) => e.id));
      const filteredResults = allResults.filter((r) => examIdSet.has(r.exam_id));

      setClasses(clsList);
      setStudents(stuList);
      setExams(exmList);
      setResults(filteredResults);

      // 기본 오답률 분석 대상: 채점 결과가 있는 가장 최근 시험 (없으면 첫 번째 시험)
      const examWithResult = exmList.find((ex) =>
        filteredResults.some((r) => r.exam_id === ex.id)
      );
      if (examWithResult) setSelectedExamId(examWithResult.id);
      else if (exmList.length > 0) setSelectedExamId(exmList[0].id);

      setLoading(false);
    };

    fetchDashboardData();
  }, [profile]);

  const classMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [classes]);

  const studentMap = useMemo(() => {
    const map: Record<string, StudentRow> = {};
    students.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  const examMap = useMemo(() => {
    const map: Record<string, ExamRow> = {};
    exams.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [exams]);

  // 시험별 통계 계산
  const examStats = useMemo(() => {
    return exams.map((ex) => {
      const exResults = results.filter((r) => r.exam_id === ex.id);
      const count = exResults.length;
      const avg =
        count > 0
          ? Math.round(
              (exResults.reduce((sum, r) => sum + Number(r.score || 0), 0) / count) * 10
            ) / 10
          : null;
      const max =
        count > 0 ? Math.max(...exResults.map((r) => Number(r.score || 0))) : null;

      return {
        ...ex,
        className: ex.class_id ? classMap[ex.class_id] || '-' : '-',
        count,
        avg,
        max,
        exResults,
      };
    });
  }, [exams, results, classMap]);

  // 하단 문항별 오답률 계산
  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  const selectedExamResults = useMemo(
    () => results.filter((r) => r.exam_id === selectedExamId),
    [results, selectedExamId]
  );

  const questionStats = useMemo(() => {
    if (!selectedExam) return [];
    const qs = Array.isArray(selectedExam.questions) ? selectedExam.questions : [];
    const totalStudents = selectedExamResults.length;

    return qs
      .map((q) => {
        const wrongStudents = selectedExamResults
          .filter((r) => Array.isArray(r.wrong_numbers) && r.wrong_numbers.includes(q.num))
          .map((r) => studentMap[r.student_id])
          .filter(Boolean) as StudentRow[];

        const rate =
          totalStudents > 0 ? Math.round((wrongStudents.length / totalStudents) * 100) : 0;

        return {
          num: q.num,
          unit: q.unit || '단원 미지정',
          answer: q.answer || '-',
          score: q.score ?? null,
          wrongCount: wrongStudents.length,
          wrongStudents,
          rate,
        };
      })
      .sort((a, b) => b.rate - a.rate || a.num - b.num);
  }, [selectedExam, selectedExamResults, studentMap]);

  const modalExam = modalExamId ? examStats.find((e) => e.id === modalExamId) || null : null;
  const selectedQuestionDetail =
    selectedQuestionNum !== null
      ? questionStats.find((q) => q.num === selectedQuestionNum) || null
      : null;

  if (loading) {
    return <div className="text-sm text-gray-400 p-8">대시보드 데이터를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        운영 중인 클래스와 최근 시험 채점·오답률 통계를 한눈에 확인합니다. 각 항목을 클릭하면 상세 내용을 볼 수 있습니다.
      </p>

      {/* 상단 요약 카드 4개 (클릭 가능) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => router.push('/')}
          className="text-left bg-[#161922] border border-gray-800 hover:border-blue-500/60 hover:bg-gray-800/40 rounded-xl p-5 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>운영 클래스</span>
            <BookOpen size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{classes.length}개</div>
        </button>

        <button
          onClick={() => router.push('/students')}
          className="text-left bg-[#161922] border border-gray-800 hover:border-emerald-500/60 hover:bg-gray-800/40 rounded-xl p-5 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>전체 수강생</span>
            <Users size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{students.length}명</div>
        </button>

        <button
          onClick={() => router.push('/exams')}
          className="text-left bg-[#161922] border border-gray-800 hover:border-purple-500/60 hover:bg-gray-800/40 rounded-xl p-5 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>등록 시험지</span>
            <FileText size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{exams.length}건</div>
        </button>

        <button
          onClick={() => setShowGradedModal(true)}
          className="text-left bg-[#161922] border border-gray-800 hover:border-amber-500/60 hover:bg-gray-800/40 rounded-xl p-5 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>누적 채점 완료</span>
            <CheckCircle2 size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{results.length}건</div>
        </button>
      </div>

      {/* 최근 시험 목록 테이블 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-end">
          <Link
            href="/exams"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
          >
            채점 화면으로 이동 <ArrowRight size={13} />
          </Link>
        </div>

        <div className="bg-[#161922] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400 bg-[#0f1117]/60">
                  <th className="py-3.5 px-4 font-medium">시험지명</th>
                  <th className="py-3.5 px-4 font-medium">클래스</th>
                  <th className="py-3.5 px-4 font-medium">응시 인원</th>
                  <th className="py-3.5 px-4 font-medium">평균 / 최고</th>
                  <th className="py-3.5 px-4 font-medium text-right">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/70 text-sm">
                {examStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-gray-500">
                      등록된 시험이 없습니다.
                    </td>
                  </tr>
                ) : (
                  examStats.map((ex) => {
                    const isSelected = ex.id === selectedExamId;
                    return (
                      <tr
                        key={ex.id}
                        onClick={() => {
                          setSelectedExamId(ex.id);
                          setModalExamId(ex.id);
                        }}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-gray-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <span className="hover:text-blue-400 hover:underline underline-offset-4">
                            {ex.title}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-300 text-xs">{ex.className}</td>
                        <td className="py-3.5 px-4 text-gray-300 text-xs">{ex.count}명</td>
                        <td className="py-3.5 px-4 text-xs">
                          {ex.avg !== null ? (
                            <span>
                              <span className="text-blue-400 font-bold">{ex.avg}점</span>
                              <span className="text-gray-500"> / </span>
                              <span className="text-emerald-400 font-bold">{ex.max}점</span>
                            </span>
                          ) : (
                            <span className="text-gray-500">미채점</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs text-gray-400">
                          {new Date(ex.created_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 하단 문항별 오답률 섹션 */}
      {selectedExam && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-rose-400 text-sm font-semibold">
            <AlertTriangle size={16} />
            <span>문항별 오답률 분석 (문항을 클릭하면 오답 학생을 확인할 수 있습니다)</span>
          </div>

          <div className="bg-[#161922] border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{selectedExam.title}</span>
                <span className="text-xs text-gray-400">
                  (응시 {selectedExamResults.length}명 · 총{' '}
                  {Array.isArray(selectedExam.questions) ? selectedExam.questions.length : 0}문항)
                </span>
              </div>
              <button
                onClick={() => setModalExamId(selectedExam.id)}
                className="text-xs text-blue-400 hover:underline"
              >
                응시 학생 전체 보기 →
              </button>
            </div>

            {questionStats.length === 0 ? (
              <div className="text-xs text-gray-500 py-4 text-center">
                등록된 문항 정보가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {questionStats.slice(0, 10).map((q) => (
                  <button
                    key={q.num}
                    onClick={() => setSelectedQuestionNum(q.num)}
                    className="text-left bg-[#0f1117] border border-gray-800 hover:border-rose-500/60 hover:bg-gray-800/40 rounded-lg p-3.5 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{q.num}번</span>
                      <span
                        className={`text-xs font-bold ${
                          q.rate >= 50 ? 'text-rose-400' : q.rate > 0 ? 'text-amber-400' : 'text-gray-400'
                        }`}
                      >
                        {q.rate}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${
                          q.rate >= 50 ? 'bg-rose-500' : 'bg-amber-400'
                        }`}
                        style={{ width: `${q.rate}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{q.unit}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모달 1: 누적 채점 완료 전체 목록 */}
      {showGradedModal && (
        <div
          onClick={() => setShowGradedModal(false)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#161922] border border-gray-700 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-[#161922] border-b border-gray-800 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-amber-400" />
                누적 채점 완료 기록 ({results.length}건)
              </h2>
              <button
                onClick={() => setShowGradedModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 divide-y divide-gray-800/70">
              {results.length === 0 ? (
                <div className="text-xs text-gray-500 py-8 text-center">채점 기록이 없습니다.</div>
              ) : (
                results.map((r) => {
                  const st = studentMap[r.student_id];
                  const ex = examMap[r.exam_id];
                  const wrongs = Array.isArray(r.wrong_numbers) ? r.wrong_numbers : [];
                  return (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {st?.name || '알 수 없는 학생'}{' '}
                          <span className="text-xs font-normal text-gray-400">
                            · {ex?.title || '시험명 없음'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          오답:{' '}
                          {wrongs.length > 0 ? (
                            <span className="text-rose-400">{wrongs.join(', ')}번</span>
                          ) : (
                            <span className="text-emerald-400">만점</span>
                          )}
                        </div>
                      </div>
                      <div className="text-base font-bold text-blue-400">{r.score}점</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 선택한 시험의 응시 학생 성적 상세 */}
      {modalExam && (
        <div
          onClick={() => setModalExamId(null)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#161922] border border-gray-700 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-[#161922] border-b border-gray-800 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Award size={18} className="text-blue-400" />
                  {modalExam.title}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalExam.className} · 응시 {modalExam.count}명
                  {modalExam.avg !== null && ` · 평균 ${modalExam.avg}점 / 최고 ${modalExam.max}점`}
                </p>
              </div>
              <button
                onClick={() => setModalExamId(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {modalExam.exResults.length === 0 ? (
                <div className="text-xs text-gray-500 py-8 text-center">
                  아직 채점된 학생이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-800/70">
                  {[...modalExam.exResults]
                    .sort((a, b) => Number(b.score) - Number(a.score))
                    .map((r, idx) => {
                      const st = studentMap[r.student_id];
                      const wrongs = Array.isArray(r.wrong_numbers) ? r.wrong_numbers : [];
                      return (
                        <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {st?.name || '알 수 없는 학생'}
                                {st?.school && (
                                  <span className="text-xs font-normal text-gray-400 ml-1.5">
                                    ({st.school})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                오답:{' '}
                                {wrongs.length > 0 ? (
                                  <span className="text-rose-400">{wrongs.join(', ')}번</span>
                                ) : (
                                  <span className="text-emerald-400">만점</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-base font-bold text-blue-400">{r.score}점</div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="pt-3 border-t border-gray-800 flex justify-end">
                <Link
                  href="/exams"
                  className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                >
                  채점 화면에서 수정하기
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달 3: 문항별 오답 학생 상세 */}
      {selectedQuestionDetail && selectedExam && (
        <div
          onClick={() => setSelectedQuestionNum(null)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#161922] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="border-b border-gray-800 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserX size={18} className="text-rose-400" />
                  {selectedQuestionDetail.num}번 문항 오답 상세
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedExam.title}</p>
              </div>
              <button
                onClick={() => setSelectedQuestionNum(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
                  <div className="text-[11px] text-gray-400">정답</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {selectedQuestionDetail.answer}
                  </div>
                </div>
                <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
                  <div className="text-[11px] text-gray-400">오답률</div>
                  <div className="text-sm font-bold text-rose-400 mt-0.5">
                    {selectedQuestionDetail.rate}%
                  </div>
                </div>
                <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
                  <div className="text-[11px] text-gray-400">단원</div>
                  <div className="text-xs font-medium text-white mt-1 truncate">
                    {selectedQuestionDetail.unit}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-400 mb-2">
                  틀린 학생 ({selectedQuestionDetail.wrongStudents.length}명)
                </div>
                {selectedQuestionDetail.wrongStudents.length === 0 ? (
                  <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-4 text-center text-xs text-emerald-400">
                    전원 정답입니다!
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedQuestionDetail.wrongStudents.map((st) => (
                      <span
                        key={st.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/20"
                      >
                        {st.name} {st.school ? `(${st.school})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
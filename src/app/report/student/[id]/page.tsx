'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Award,
  TrendingUp,
  FileCheck2,
  CheckCircle2,
  XCircle,
  BookOpen,
  Printer,
} from 'lucide-react';
import WrongNoteModal, { WrongNoteItem } from '@/components/WrongNoteModal';

interface StudentInfo {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
}

interface QuestionItem {
  num: number;
  answer?: string;
  unit?: string;
  score?: number;
  image_url?: string;
}

interface ExamResultRow {
  id: string;
  score: number;
  answers: Record<string, string> | null;
  wrong_numbers: number[] | null;
  created_at: string;
  exams: {
    id: string;
    title: string;
    questions: QuestionItem[] | null;
  } | null;
}

export default function StudentPublicReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = use(params);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [results, setResults] = useState<ExamResultRow[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [wrongModalOpen, setWrongModalOpen] = useState(false);
  const [selectedWrongId, setSelectedWrongId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<
    {
      id: string;
      class_id: string;
      session_no: number;
      session_date: string;
      topic: string | null;
      memo: string | null;
      exam_id: string | null;
    }[]
  >([]);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      const [stuRes, clsRes, resRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, name, school, grade')
          .eq('id', studentId)
          .single(),
supabase
          .from('class_students')
          .select('class_id, classes(name)')
          .eq('student_id', studentId),
        supabase
          .from('exam_results')
          .select('id, score, answers, wrong_numbers, created_at, exams(id, title, questions)')
          .eq('student_id', studentId)
          .order('created_at', { ascending: true }),
      ]);

      if (stuRes.data) setStudent(stuRes.data as StudentInfo);
      if (clsRes.data) {
        const names = clsRes.data
          .map((row: any) => row.classes?.name)
          .filter(Boolean);
        setClasses(names);

        const classIds = clsRes.data
          .map((row: any) => row.class_id)
          .filter(Boolean);
        if (classIds.length > 0) {
          const { data: sessData } = await supabase
            .from('class_sessions')
            .select('id, class_id, session_no, session_date, topic, memo, exam_id')
            .in('class_id', classIds)
            .order('session_date', { ascending: true })
            .order('session_no', { ascending: true });
          if (sessData) setSessions(sessData);
        }
      }
      if (resRes.data) {
        const list = resRes.data as unknown as ExamResultRow[];
        setResults(list);
        // 기본값: 가장 최근 시험이 있으면 최근 시험 선택
        if (list.length > 0) {
          setSelectedResultId(list[list.length - 1].id);
        }
      }
      setLoading(false);
    };

    if (studentId) fetchReport();
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-gray-400 flex items-center justify-center text-sm">
        성적표를 불러오는 중...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-gray-400 flex items-center justify-center text-sm">
        학생 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const totalExams = results.length;
  const avgScore =
    totalExams > 0
      ? Math.round(
          (results.reduce((sum, r) => sum + Number(r.score || 0), 0) / totalExams) * 10
        ) / 10
      : 0;
  const maxScore =
    totalExams > 0 ? Math.max(...results.map((r) => Number(r.score || 0))) : 0;
  const latestScore =
    totalExams > 0 ? Number(results[results.length - 1].score || 0) : 0;

  const selectedResult =
    selectedResultId === 'all'
      ? null
      : results.find((r) => r.id === selectedResultId) || null;
  const activeSession =
    (selectedResult?.exams?.id
      ? sessions.find((s) => s.exam_id === selectedResult.exams?.id)
      : null) ||
    (sessions.length > 0 ? sessions[sessions.length - 1] : null);

const allWrongItems: WrongNoteItem[] = [...results].reverse().flatMap((r) => {
    const wrongs = Array.isArray(r.wrong_numbers) ? r.wrong_numbers : [];
    const qs = Array.isArray(r.exams?.questions) ? r.exams!.questions! : [];
    return wrongs.map((wNum) => {
      const q = qs.find((item) => item.num === wNum);
      return {
        id: `${r.id}-${wNum}`,
        examTitle: r.exams?.title || '시험',
        examDate: r.created_at,
        num: wNum,
        unit: q?.unit,
        studentAnswer: r.answers?.[String(wNum)] || '-',
        correctAnswer: q?.answer || '-',
        image_url: q?.image_url,
      };
    });
  });

  return (
    <div className="min-h-screen bg-[#0f1117] text-white py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 상단 헤더 */}
        <div className="bg-[#161922] border border-gray-800 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-blue-400 mb-1">ClassNote 성적 리포트</div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Award className="text-blue-400" size={24} />
                {student.name} 학생
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {student.school || '학교 미입력'} · {student.grade || '학년 미입력'}
              </p>
            </div>
            {classes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {classes.map((c, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20"
                  >
                    <BookOpen size={12} /> {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 누적 성적 요약 4칸 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400">총 응시 횟수</div>
            <div className="text-2xl font-bold text-white mt-1">{totalExams}회</div>
          </div>
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400">누적 평균</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{avgScore}점</div>
          </div>
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400">최고 점수</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{maxScore}점</div>
          </div>
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400">최근 점수</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{latestScore}점</div>
          </div>
        </div>
{/* 이번 주 진도사항 & 공지사항 */}
        {activeSession && (activeSession.topic || activeSession.memo) && (
          <div className="bg-[#161922] border border-gray-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1.5 font-semibold text-blue-400">
                <BookOpen size={15} /> 수업 안내 ({activeSession.session_no}회차)
              </span>
              {activeSession.session_date && <span>{activeSession.session_date}</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeSession.topic && (
                <div className="bg-[#0f1117] border border-gray-800/80 rounded-xl p-3.5">
                  <div className="text-xs font-semibold text-emerald-400 mb-1">
                    이번 주 진도사항
                  </div>
                  <div className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">
                    {activeSession.topic}
                  </div>
                </div>
              )}

              {activeSession.memo && (
                <div className="bg-[#0f1117] border border-gray-800/80 rounded-xl p-3.5">
                  <div className="text-xs font-semibold text-amber-400 mb-1">
                    공지사항
                  </div>
                  <div className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">
                    {activeSession.memo}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 누적 점수 추이 그래프 */}
        {totalExams > 0 && (
          <div className="bg-[#161922] border border-gray-800 rounded-2xl p-5">
            <div className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-blue-400" />
              회차별 점수 추이 (막대를 클릭하면 해당 회차 상세를 볼 수 있습니다)
            </div>
            <div className="flex items-end gap-4 h-40 overflow-x-auto pt-2 pb-1">
              {results.map((r, idx) => {
                const score = Math.min(100, Math.max(0, Number(r.score || 0)));
                const isSelected = selectedResultId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedResultId(r.id)}
                    className="flex flex-col items-center min-w-[64px] h-full justify-end group cursor-pointer"
                  >
                    <span
                      className={`text-xs font-bold mb-1 ${
                        isSelected ? 'text-amber-400' : 'text-blue-300'
                      }`}
                    >
                      {score}점
                    </span>
                    <div className="w-9 bg-gray-800 rounded-t-md h-24 flex items-end overflow-hidden">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          isSelected ? 'bg-amber-400' : 'bg-blue-500 group-hover:bg-blue-400'
                        }`}
                        style={{ height: `${score}%` }}
                      />
                    </div>
                    <span
                      className={`text-[11px] mt-1.5 truncate max-w-[72px] ${
                        isSelected ? 'text-white font-semibold' : 'text-gray-400'
                      }`}
                      title={r.exams?.title}
                    >
                      {r.exams?.title || `${idx + 1}회차`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 회차 선택 탭 (전체 보기 / 개별 회차 보기) */}
        <div className="bg-[#161922] border border-gray-800 rounded-2xl p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-3">
            <button
              onClick={() => setSelectedResultId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedResultId === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0f1117] text-gray-400 hover:text-white'
              }`}
            >
              전체 회차 요약 ({totalExams})
            </button>
            {[...results].reverse().map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedResultId(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedResultId === r.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0f1117] text-gray-400 hover:text-white'
                }`}
              >
                {r.exams?.title || '시험'} ({r.score}점)
              </button>
            ))}
            {allWrongItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedWrongId(null);
                setWrongModalOpen(true);
              }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold text-rose-300 transition"
            >
              <Printer size={13} /> 누적 오답 ({allWrongItems.length}문항) · 출력
            </button>
          )}
          </div>

          {totalExams === 0 ? (
            <div className="text-center text-xs text-gray-500 py-8">
              아직 채점된 시험 기록이 없습니다.
            </div>
          ) : selectedResultId === 'all' ? (
            /* 전체 회차 목록 */
            <div className="divide-y divide-gray-800/70">
              {[...results].reverse().map((r) => {
                const wrongs = Array.isArray(r.wrong_numbers) ? r.wrong_numbers : [];
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedResultId(r.id)}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-gray-800/30 px-2 rounded-lg transition"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {r.exams?.title || '시험명 없음'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        응시일: {new Date(r.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-gray-400">
                        오답:{' '}
                        {wrongs.length > 0 ? (
                          <span className="text-rose-400 font-medium">{wrongs.join(', ')}번</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">만점</span>
                        )}
                      </div>
                      <div className="text-lg font-bold text-blue-400 min-w-[52px] text-right">
                        {r.score}점
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 선택한 1개 회차 상세 보기 */
            selectedResult && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f1117] border border-gray-800 rounded-xl p-4">
                  <div>
                    <div className="text-base font-bold text-white flex items-center gap-2">
                      <FileCheck2 size={16} className="text-blue-400" />
                      {selectedResult.exams?.title || '시험명 없음'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      응시일: {new Date(selectedResult.created_at).toLocaleDateString('ko-KR')} · 오답:{' '}
                      {Array.isArray(selectedResult.wrong_numbers) &&
                      selectedResult.wrong_numbers.length > 0 ? (
                        <span className="text-rose-400 font-medium">
                          {selectedResult.wrong_numbers.join(', ')}번
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-medium">없음 (만점)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-400">{selectedResult.score}점</div>
                </div>

                {/* 문항별 정오표 */}
                {Array.isArray(selectedResult.exams?.questions) &&
                  selectedResult.exams!.questions!.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                      {selectedResult.exams!.questions!.map((q) => {
                        const isWrong =
                          Array.isArray(selectedResult.wrong_numbers) &&
                          selectedResult.wrong_numbers.includes(q.num);
                        const studentAns =
                          selectedResult.answers?.[String(q.num)] ?? '-';
                        return (
                        <div
                          key={q.num}
                          onClick={() => {
                            if (!isWrong) return;
                            setSelectedWrongId(`${selectedResult.id}-${q.num}`);
                            setWrongModalOpen(true);
                          }}
                          className={`rounded-lg p-3 border text-xs transition ${
                            isWrong
                              ? 'bg-rose-500/10 border-rose-500/30 cursor-pointer hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 border-emerald-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white">{q.num}번</span>
                            {isWrong ? (
                              <XCircle size={14} className="text-rose-400" />
                            ) : (
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            )}
                          </div>
                          <div className="text-[11px] text-gray-300">
                            제출: <span className="font-semibold text-white">{studentAns}</span>
                          </div>
                          {isWrong && q.answer && (
                            <div className="text-[11px] text-rose-300">
                              정답: <span className="font-semibold">{q.answer}</span>
                            </div>
                          )}
                          {isWrong && q.image_url && (
                            <div className="mt-1 text-[10px] text-blue-300 font-medium">
                              클릭하여 문제 보기
                            </div>
                          )}
                        </div>
                      );
                      })}
                    </div>
                  )}
              </div>
            )
          )}
        </div>
      </div>
      {wrongModalOpen && student && (
        <WrongNoteModal
          studentName={student.name}
          items={allWrongItems}
          initialSelectedId={selectedWrongId}
          onClose={() => setWrongModalOpen(false)}
        />
      )}
    </div>
  );
}
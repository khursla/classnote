'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, XCircle, Award, TrendingUp, BookOpen, Printer } from 'lucide-react';
import WrongNoteModal from '@/components/WrongNoteModal';

interface Question {
  num: number;
  answer: string;
  score: number;
  unit?: string;
  image_url?: string;
}

interface ReportData {
  result: {
    id: string;
    score: number;
    answers: Record<string, string>;
    wrong_numbers: number[];
    created_at: string;
  };
  student: {
    name: string;
    school: string;
    grade: string;
  };
  exam: {
    title: string;
    question_count: number;
    questions: Question[];
    progress?: string;
    notice?: string;
  };
  className: string;
  avgScore: number;
  maxScore: number;
  totalExaminees: number;
}

export default function MobileReportPage() {
  const params = useParams();
  const resultId = params?.id as string;
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [wrongModalOpen, setWrongModalOpen] = useState(false);
  const [selectedWrongId, setSelectedWrongId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!resultId) return;
      setLoading(true);

      // 1. 채점 결과 조회
      const { data: resData, error: resErr } = await supabase
        .from('exam_results')
        .select('*')
        .eq('id', resultId)
        .single();

      if (resErr || !resData) {
        setErrorMsg('성적표를 찾을 수 없습니다. 링크를 다시 확인해 주세요.');
        setLoading(false);
        return;
      }

      // 2. 학생, 시험지, 같은 시험 전체 결과(평균/최고점용) 동시 조회
      const [stuRes, exmRes, allRes] = await Promise.all([
        supabase.from('students').select('name, school, grade').eq('id', resData.student_id).single(),
        supabase.from('exams').select('*').eq('id', resData.exam_id).single(),
        supabase.from('exam_results').select('score').eq('exam_id', resData.exam_id),
      ]);

      if (!stuRes.data || !exmRes.data) {
        setErrorMsg('학생 또는 시험지 정보가 삭제되었습니다.');
        setLoading(false);
        return;
      }

      // 3. 클래스명 조회
      let className = '주간 테스트';
      if (exmRes.data.class_id) {
        const { data: clsData } = await supabase
          .from('classes')
          .select('name')
          .eq('id', exmRes.data.class_id)
          .single();
        if (clsData) className = clsData.name;
      }

      // 4. 반 평균 / 최고점 계산
      const scores = (allRes.data || []).map((r) => Number(r.score));
      const totalExaminees = scores.length;
      const avgScore =
        totalExaminees > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / totalExaminees) * 10) / 10
          : 0;
      const maxScore = totalExaminees > 0 ? Math.max(...scores) : 0;

      setData({
        result: resData,
        student: stuRes.data,
        exam: exmRes.data,
        className,
        avgScore,
        maxScore,
        totalExaminees,
      });
      setLoading(false);
    };

    fetchReport();
  }, [resultId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        성적표를 불러오는 중...
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-400 text-sm p-6 text-center">
        {errorMsg || '성적표를 불러올 수 없습니다.'}
      </div>
    );
  }

  const { result, student, exam, className, avgScore, maxScore, totalExaminees } = data;
  const totalPossible = (exam.questions || []).reduce((acc, q) => acc + (Number(q.score) || 0), 0) || 100;
  const scoreDiff = Math.round((Number(result.score) - avgScore) * 10) / 10;

  return (
    <div className="max-w-md mx-auto pb-12">
      {/* 상단 성적표 헤더 카드 */}
      <div className="bg-gradient-to-br from-[#16203a] to-[#0f172a] border border-blue-500/30 rounded-2xl p-6 mb-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300">
            ClassNote 성적표
          </span>
          <span className="text-xs text-gray-400">
            {new Date(result.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>

        <div className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
          <BookOpen size={13} /> {className}
        </div>
        <h1 className="text-xl font-bold text-white mb-4">{exam.title}</h1>

        <div className="bg-black/30 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-white">{student.name} 학생</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {student.school || '학교 미입력'} · {student.grade || ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold text-blue-400">
              {result.score}
              <span className="text-sm font-normal text-gray-400"> / {totalPossible}점</span>
            </div>
          </div>
        </div>
      </div>

      {/* 반 평균 / 최고점 비교 카드 */}
      <div className="bg-[#161922] border border-gray-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <TrendingUp size={16} className="text-emerald-400" /> 성적 분석
          </h2>
          <span className="text-xs text-gray-400">응시 {totalExaminees}명 기준</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-4 text-center">
          <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-3">
            <div className="text-[11px] text-gray-400 mb-1">내 점수</div>
            <div className="text-lg font-extrabold text-blue-400">{result.score}점</div>
          </div>
          <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-3">
            <div className="text-[11px] text-gray-400 mb-1">반 평균</div>
            <div className="text-lg font-bold text-gray-200">{avgScore}점</div>
          </div>
          <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-3">
            <div className="text-[11px] text-gray-400 mb-1">반 최고점</div>
            <div className="text-lg font-bold text-emerald-400">{maxScore}점</div>
          </div>
        </div>

        <div className="text-xs text-center py-2 px-3 rounded-lg bg-[#0f1117] text-gray-300">
          {scoreDiff > 0 ? (
            <span>
              반 평균보다 <strong className="text-emerald-400">+{scoreDiff}점</strong> 높습니다!
            </span>
          ) : scoreDiff < 0 ? (
            <span>
              반 평균 대비 <strong className="text-amber-400">{scoreDiff}점</strong>입니다. 오답 문항을 꼭 복습해 주세요.
            </span>
          ) : (
            <span>반 평균과 동일한 점수입니다.</span>
          )}
        </div>
      </div>

      {/* 문항별 정오표 */}
      <div className="bg-[#161922] border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Award size={16} className="text-amber-400" /> 문항별 정오표
          </h2>
          <div className="flex items-center gap-2">
          <span className="text-xs text-rose-400">
            오답 {result.wrong_numbers?.length || 0}문항
          </span>
          {(result.wrong_numbers?.length || 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedWrongId(null);
                setWrongModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-semibold text-rose-300 transition"
            >
              <Printer size={12} /> 오답 출력
            </button>
          )}
        </div>
        </div>

        <div className="space-y-2">
          {(exam.questions || []).map((q) => {
            const studentAns = result.answers?.[String(q.num)] || '-';
            const isWrong = (result.wrong_numbers || []).includes(q.num);

            return (
              <div
                key={q.num}
                onClick={() => {
                  if (!isWrong) return;
                  setSelectedWrongId(`${result.id}-${q.num}`);
                  setWrongModalOpen(true);
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs transition ${
                  isWrong
                    ? 'bg-rose-950/20 border-rose-500/30 cursor-pointer hover:bg-rose-950/35'
                    : 'bg-[#0f1117] border-gray-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-white w-8">{q.num}번</span>
                  <span className="text-gray-400">{q.unit || '일반 문항'}</span>
                  {isWrong && q.image_url && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-medium">
                      문제 보기
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">
                    제출: <strong className="text-gray-200">{studentAns}</strong>
                  </span>
                  {isWrong && (
                    <span className="text-emerald-400">
                      정답: <strong>{q.answer}</strong>
                    </span>
                  )}
                  {isWrong ? (
                    <XCircle size={16} className="text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 진도사항 & 공지사항 카드 */}
      {(exam.progress || exam.notice) && (
        <div className="bg-[#161b26] border border-gray-800 rounded-2xl p-5 mt-5 space-y-4">
          {exam.progress && (
            <div>
              <h3 className="text-xs font-semibold text-blue-400 mb-1.5">
                📚 이번 주 진도사항
              </h3>
              <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">
                {exam.progress}
              </p>
            </div>
          )}

          {exam.progress && exam.notice && (
            <div className="border-t border-gray-800" />
          )}

          {exam.notice && (
            <div>
              <h3 className="text-xs font-semibold text-amber-400 mb-1.5">
                📢 공지사항
              </h3>
              <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">
                {exam.notice}
              </p>
            </div>
          )}
        </div>
      )}
      {wrongModalOpen && (
        <WrongNoteModal
          studentName={student.name}
          initialSelectedId={selectedWrongId}
          items={(exam.questions || [])
            .filter((q) => (result.wrong_numbers || []).includes(q.num))
            .map((q) => ({
              id: `${result.id}-${q.num}`,
              examTitle: exam.title,
              examDate: result.created_at,
              num: q.num,
              unit: q.unit,
              studentAnswer: result.answers?.[String(q.num)] || '-',
              correctAnswer: q.answer,
              image_url: q.image_url,
            }))}
          onClose={() => setWrongModalOpen(false)}
        />
      )}
    </div>
  );
}
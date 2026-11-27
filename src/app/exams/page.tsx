'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Edit3,
  Upload,
  ExternalLink,
  Share2, // ◀ 이 한 줄만 추가!
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import PdfQuestionCropper, { CroppedQuestionResult } from '@/components/PdfQuestionCropper';
interface Question {
  num: number;
  type: 'mcq' | 'short';
  answer: string;
  score: number;
  unit: string;
  image_url?: string;
}

interface Exam {
  progress?: string;
  notice?: string;
  id: string;
  class_id: string | null;
  title: string;
  question_count: number;
  questions: Question[];
  file_url?: string | null;
}

interface Student {
  id: string;
  name: string;
  school: string;
}

interface ExamResult {
  id?: string;
  exam_id: string;
  student_id: string;
  answers: Record<string, string>;
  score: number;
  wrong_numbers: number[];
}

interface ClassItem {
  id: string;
  name: string;
}

export default function ExamsPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classStudents, setClassStudents] = useState<
    { class_id: string; student_id: string }[]
  >([]);
  const [results, setResults] = useState<ExamResult[]>([]);

  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeQIndex, setActiveQIndex] = useState<number>(0);
  const [bulkScore, setBulkScore] = useState<string>('5');

  // 시험지 생성/수정 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [examClassId, setExamClassId] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [quickAnswerStr, setQuickAnswerStr] = useState('');
  const [draftQuestions, setDraftQuestions] = useState<Question[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [examProgress, setExamProgress] = useState('');
  const [examNotice, setExamNotice] = useState('');

  // 초기 데이터 불러오기
  const fetchBaseData = async () => {
    if (!profile?.id) return;

    const clsQuery = supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false });

    const exmQuery = supabase
      .from('exams')
      .select('*')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false });

   const stuQuery = supabase
      .from('students')
      .select('*')
      .order('name', { ascending: true });

    const [clsRes, stuRes, exmRes, csRes] = await Promise.all([
      clsQuery,
      stuQuery,
      exmQuery,
      supabase.from('class_students').select('class_id, student_id'),
    ]);

    const myClasses = clsRes.data || [];
    const allLinks = csRes.data || [];
    setClasses(myClasses);
    setClassStudents(allLinks);

    if (stuRes.data) {
      const myClassIds = new Set(myClasses.map((c: any) => c.id));
      const myEnrolledIds = new Set(
        allLinks
          .filter((l: any) => myClassIds.has(l.class_id))
          .map((l: any) => l.student_id)
      );
      const myStudents = stuRes.data.filter(
        (s: any) => s.teacher_id === profile.id || myEnrolledIds.has(s.id)
      );
      setStudents(myStudents);
      if (myStudents.length > 0 && !selectedStudentId) {
        setSelectedStudentId(myStudents[0].id);
      }
    }

    if (exmRes.data) {
      setExams(exmRes.data);
      if (exmRes.data.length > 0 && !selectedExamId) {
        setSelectedExamId(exmRes.data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, [profile]);

  // 선택된 시험지의 채점 결과 불러오기
  const fetchResults = async (examId: string) => {
    if (!examId) return;
    const { data } = await supabase
      .from('exam_results')
      .select('*')
      .eq('exam_id', examId);
    if (data) setResults(data);
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchResults(selectedExamId);
    } else {
      setResults([]);
    }
  }, [selectedExamId]);

  // 선택된 학생이 바뀔 때 기존 저장된 답안 불러오기
  useEffect(() => {
    if (!selectedExamId || !selectedStudentId) {
      setCurrentAnswers({});
      return;
    }
    const existing = results.find((r) => r.student_id === selectedStudentId);
    setCurrentAnswers(existing?.answers || {});
  }, [selectedExamId, selectedStudentId, results]);

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  );
// 선택된 시험지의 클래스 소속 학생만 필터링
  const filteredStudents = useMemo(() => {
    if (!selectedExam?.class_id) return students;
    const allowedIds = new Set(
      classStudents
        .filter((cs) => cs.class_id === selectedExam.class_id)
        .map((cs) => cs.student_id)
    );
    return students.filter((st) => allowedIds.has(st.id));
  }, [students, classStudents, selectedExam]);

  // 시험지를 바꿨을 때 현재 선택된 학생이 해당 반 소속이 아니면 첫 번째 학생으로 자동 변경
  useEffect(() => {
    if (filteredStudents.length > 0) {
      const exists = filteredStudents.some((st) => st.id === selectedStudentId);
      if (!exists) {
        setSelectedStudentId(filteredStudents[0].id);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [filteredStudents, selectedStudentId]);

  // 문항 수 변경 시 draftQuestions 동기화
  const syncQuestionCount = (count: number) => {
    const safeCount = Math.max(1, Math.min(50, count));
    setQuestionCount(safeCount);
    setDraftQuestions((prev) => {
      const next: Question[] = [];
      const baseScore = Math.floor(100 / safeCount);
      const remainder = 100 - baseScore * safeCount;
      for (let i = 1; i <= safeCount; i++) {
        if (prev[i - 1]) {
          next.push(prev[i - 1]);
        } else {
          next.push({
            num: i,
            type: 'mcq',
            answer: '1',
            score: i <= remainder ? baseScore + 1 : baseScore,
            unit: '',
          });
        }
      }
      return next;
    });
  };

  // 100점 균등 배분
  const handleDistribute100 = () => {
    const n = draftQuestions.length;
    if (n === 0) return;
    const base = Math.floor(100 / n);
    const rem = 100 - base * n;
    setDraftQuestions((prev) =>
      prev.map((q, idx) => ({ ...q, score: idx < rem ? base + 1 : base }))
    );
  };

  // 정답 문자열 빠른 일괄 입력
  const handleApplyQuickAnswers = () => {
    const cleaned = quickAnswerStr.replace(/\s+/g, '');
    if (!cleaned) return;
    setDraftQuestions((prev) =>
      prev.map((q, idx) => ({
        ...q,
        answer: cleaned[idx] ? cleaned[idx] : q.answer,
      }))
    );
  };

  // 새 시험지 모달 열기
  const openCreateModal = () => {
    setEditingExamId(null);
    setExamTitle('');
    setExamClassId(classes[0]?.id || '');
    setQuickAnswerStr('');
    setSelectedFile(null);
    setExistingFileUrl(null);
    const initCount = 10;
    setQuestionCount(initCount);
    setDraftQuestions(
      Array.from({ length: initCount }, (_, idx) => ({
        num: idx + 1,
        type: 'mcq',
        answer: '1',
        score: 10,
        unit: '',
      }))
    );
    setShowModal(true);
    setExamProgress('');
    setExamNotice('');
  };

  // 기존 시험지 수정 모달 열기
  const openEditModal = () => {
    if (!selectedExam) return;
    setEditingExamId(selectedExam.id);
    setExamTitle(selectedExam.title);
    setExamClassId(selectedExam.class_id || '');
    setQuestionCount(selectedExam.question_count);
    setDraftQuestions(selectedExam.questions || []);
    setQuickAnswerStr('');
    setSelectedFile(null);
    setExistingFileUrl(selectedExam.file_url || null);
    setExamProgress(selectedExam.progress || '');
    setExamNotice(selectedExam.notice || '');
    setShowModal(true);
  };

  // 시험지 파일 업로드 + DB 저장
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim()) {
      alert('시험지 제목을 입력해 주세요.');
      return;
    }

    setUploading(true);
    let finalFileUrl = existingFileUrl;

    // 새 파일이 선택된 경우 Supabase Storage에 업로드
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop() || 'pdf';
      const safeFileName = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('exam-files')
        .upload(safeFileName, selectedFile);

      if (uploadError) {
        setUploading(false);
        alert('파일 업로드 실패: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('exam-files')
        .getPublicUrl(safeFileName);
      finalFileUrl = urlData.publicUrl;
    }

    const payload = {
      title: examTitle.trim(),
      class_id: examClassId || null,
      question_count: draftQuestions.length,
      questions: draftQuestions,
      file_url: finalFileUrl,
      progress: examProgress.trim(),
      notice: examNotice.trim(),
    };

    if (editingExamId) {
      const { error } = await supabase
        .from('exams')
        .update(payload)
        .eq('id', editingExamId);
      setUploading(false);
      if (error) return alert('수정 실패: ' + error.message);
    } else {
      const { data, error } = await supabase
        .from('exams')
        .insert([{ ...payload, teacher_id: profile?.id }])
        .select()
        .single();
      setUploading(false);
      if (error) return alert('저장 실패: ' + error.message);
      if (data) setSelectedExamId(data.id);
    }

    setShowModal(false);
    fetchBaseData();
  };

  // 시험지 삭제
  const handleDeleteExam = async () => {
    if (!selectedExam) return;
    if (!confirm(`'${selectedExam.title}' 시험지와 모든 채점 결과를 삭제할까요?`)) return;
    await supabase.from('exams').delete().eq('id', selectedExam.id);
    setSelectedExamId('');
    fetchBaseData();
  };
// 정답 정규화 (예: "5, 1" -> "1,5")
  const normalizeAnswer = (ans: string) =>
    ans
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(',');

  // 복수 정답 여부 확인 (정답에 콤마가 포함되어 있으면 복수 정답)
  const isMultiAnswer = (correctAns: string) =>
    (correctAns || '').includes(',');

  // 객관식 보기 선택 처리 (단일 정답은 교체, 복수 정답은 추가/해제 토글)
  const toggleMcqOption = (prevVal: string, opt: string, correctAns: string) => {
    if (!isMultiAnswer(correctAns)) {
      return prevVal === opt ? '' : opt;
    }
    const list = prevVal
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const next = list.includes(opt)
      ? list.filter((item) => item !== opt)
      : [...list, opt].sort();
    return next.join(',');
  };

  // 실시간 채점 계산
  const gradingSummary = useMemo(() => {
    if (!selectedExam) return { score: 0, totalScore: 0, wrongNumbers: [] as number[] };
    let score = 0;
    let totalScore = 0;
    const wrongNumbers: number[] = [];

    for (const q of selectedExam.questions) {
      totalScore += Number(q.score) || 0;
      const studentAns = (currentAnswers[String(q.num)] || '').trim();
      const correctAns = (q.answer || '').trim();
    if (studentAns && normalizeAnswer(studentAns) === normalizeAnswer(correctAns)) {
        score += Number(q.score) || 0;
      } else {
        wrongNumbers.push(q.num);
      }
    }
const questionTotalScore = totalScore;
    const baseScore =
      questionTotalScore > 0 && questionTotalScore < 100
        ? 100 - questionTotalScore
        : 0;
    const finalScore = score + baseScore;
    const finalTotalScore =
      questionTotalScore > 0 && questionTotalScore < 100
        ? 100
        : questionTotalScore;

    return {
      score: finalScore,
      totalScore: finalTotalScore,
      baseScore,
      wrongNumbers,
    };  }, [selectedExam, currentAnswers]);

  // 현재 학생 채점 결과 DB 저장 (Upsert)
  const handleSaveResult = async () => {
    if (!selectedExamId || !selectedStudentId) return;
    setSaving(true);
    const { error } = await supabase.from('exam_results').upsert(
      {
        exam_id: selectedExamId,
        student_id: selectedStudentId,
        answers: currentAnswers,
        score: gradingSummary.score,
        wrong_numbers: gradingSummary.wrongNumbers,
      },
      { onConflict: 'exam_id,student_id' }
    );
    setSaving(false);

    if (error) {
      alert('채점 저장 실패: ' + error.message);
    } else {
      fetchResults(selectedExamId);
    }
  };
// 시험지나 학생이 바뀌면 1번 문항으로 초기화
  useEffect(() => {
    setActiveQIndex(0);
  }, [selectedExamId, selectedStudentId]);

  // 키보드 채점 (1~5 입력 시 자동 다음 문항 이동, 방향키 이동, Backspace 지우기)
  useEffect(() => {
    if (!selectedExam || !selectedStudentId) return;
    const questions = selectedExam.questions || [];
    if (questions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력창(input, textarea, select)에 타이핑 중일 때는 무시
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const currentQ = questions[activeQIndex];
      if (!currentQ) return;
      const qKey = String(currentQ.num ?? activeQIndex + 1);

      // 1~5 숫자키 입력 -> 답안 저장 후 다음 문항으로 자동 이동
      // 1~5 숫자키 입력 -> 답안 저장 후 (복수 정답은 정답 개수만큼 입력 시) 다음 문항으로 자동 이동
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const correctAns = currentQ.answer || '';
        const requiredCount = correctAns
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean).length;

        if (requiredCount > 1) {
          setCurrentAnswers((prev: Record<string, string>) => {
            const nextVal = toggleMcqOption(prev[qKey] || '', e.key, correctAns);
            const selectedCount = nextVal
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean).length;

            if (selectedCount >= requiredCount) {
              setActiveQIndex(Math.min(questions.length - 1, activeQIndex + 1));
            }
            return {
              ...prev,
              [qKey]: nextVal,
            };
          });
        } else {
          setCurrentAnswers((prev: Record<string, string>) => ({
            ...prev,
            [qKey]: e.key,
          }));
          setActiveQIndex(Math.min(questions.length - 1, activeQIndex + 1));
        }
        return;
      }

      // 방향키 이동 (3열 그리드 기준)
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveQIndex((prev) => Math.min(questions.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveQIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveQIndex((prev) => Math.min(questions.length - 1, prev + 3));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveQIndex((prev) => Math.max(0, prev - 3));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        if (currentAnswers[qKey]) {
          setCurrentAnswers((prev: Record<string, string>) => {
            const next = { ...prev };
            delete next[qKey];
            return next;
          });
        } else {
          setActiveQIndex((prev) => Math.max(0, prev - 1));
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSaveResult();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedExam, selectedStudentId, activeQIndex, currentAnswers]);

  // 이전/다음 학생 이동
  const moveStudent = (dir: -1 | 1) => {
    const idx = filteredStudents.findIndex((s) => s.id === selectedStudentId);
    if (idx === -1) return;
    const nextIdx = idx + dir;
    if (nextIdx >= 0 && nextIdx < filteredStudents.length) {
      setSelectedStudentId(filteredStudents[nextIdx].id);
    }
  };

  // 통계 계산
  const stats = useMemo(() => {
    if (results.length === 0) return { avg: 0, max: 0, min: 0 };
    const scores = results.map((r) => Number(r.score));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return {
      avg: Math.round(avg * 10) / 10,
      max: Math.max(...scores),
      min: Math.min(...scores),
    };
  }, [results]);

  return (
    <div>
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">문제지 · 자동채점</h1>
          <p className="text-sm text-gray-400 mt-1">
            시험지(PDF/이미지)와 정답을 등록하고 학생별 답안을 입력하면 즉시 자동채점 후 DB에 저장됩니다.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition"
        >
          <Plus size={16} /> 새 시험지 업로드
        </button>
      </div>

      {/* 시험지 선택 바 */}
      <div className="bg-[#161922] border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <FileText size={18} className="text-blue-400 shrink-0" />
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="flex-1 bg-[#0f1117] border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {exams.length === 0 && <option value="">등록된 시험지가 없습니다</option>}
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.question_count}문항){ex.file_url ? ' 📎' : ''}
              </option>
            ))}
          </select>
        </div>
        {selectedExam && (
          <div className="flex flex-wrap gap-2">
            {selectedExam.file_url && (
              <a
                href={selectedExam.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium"
              >
                <ExternalLink size={14} /> 시험지 보기
              </a>
            )}
            <button
              onClick={openEditModal}
              className="bg-[#0f1117] hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Edit3 size={14} /> 수정 / 파일첨부
            </button>
            <button
              onClick={handleDeleteExam}
              className="bg-[#0f1117] hover:bg-red-950/50 border border-gray-700 text-gray-400 hover:text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        )}
      </div>

      {/* 요약 통계 카드 */}
      {selectedExam && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">채점 완료</div>
            <div className="text-xl font-bold text-white">
              {results.length} <span className="text-sm font-normal text-gray-400">/ {filteredStudents.length}명</span>
            </div>
          </div>
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">평균 점수</div>
            <div className="text-xl font-bold text-blue-400">{stats.avg}점</div>
          </div>
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">최고 점수</div>
            <div className="text-xl font-bold text-emerald-400">{stats.max}점</div>
          </div>
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">최저 점수</div>
            <div className="text-xl font-bold text-rose-400">{stats.min}점</div>
          </div>
        </div>
      )}

      {/* 학생 선택 & 문항별 채점 영역 */}
      {selectedExam ? (
        filteredStudents.length === 0 ? (
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-10 text-center text-gray-400 text-sm">
            먼저 좌측 <strong>학생 관리</strong> 메뉴에서 학생을 1명 이상 등록해 주세요.
          </div>
        ) : (
          <div className="bg-[#161922] border border-gray-800 rounded-xl p-5 mb-6">
            {/* 학생 선택 칩 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-gray-800">
              <div className="flex flex-wrap gap-2">
                {filteredStudents.map((st) => {
                  const res = results.find((r) => r.student_id === st.id);
                  const active = st.id === selectedStudentId;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStudentId(st.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition ${
                        active
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#0f1117] border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {st.name}
                      {res && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            active ? 'bg-blue-800 text-blue-100' : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {res.score}점
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => moveStudent(-1)}
                  className="p-1.5 rounded-lg bg-[#0f1117] border border-gray-700 text-gray-300 hover:bg-gray-800"
                  title="이전 학생"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => moveStudent(1)}
                  className="p-1.5 rounded-lg bg-[#0f1117] border border-gray-700 text-gray-300 hover:bg-gray-800"
                  title="다음 학생"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* 실시간 점수 & 저장 버튼 */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5 bg-[#0f1117] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-5">
                <div>
                  <div className="text-xs text-gray-400">현재 점수</div>
                  <div className="text-2xl font-extrabold text-white">
                    {gradingSummary.score}{' '}
                    <span className="text-sm font-normal text-gray-500">/ {gradingSummary.totalScore}점</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-gray-800" />
                <div>
                  <div className="text-xs text-gray-400">오답 문항</div>
                  <div className="text-sm font-medium text-rose-400 mt-0.5">
                    {gradingSummary.wrongNumbers.length > 0
                      ? gradingSummary.wrongNumbers.map((n) => `${n}번`).join(', ')
                      : '없음 (만점!)'}
                  </div>
                </div>
              </div>
             <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSaveResult}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition"
                >
                  <Save size={16} /> {saving ? '저장 중...' : '채점 결과 DB 저장'}
                </button>

                {(() => {
            const savedRes = results.find((r) => r.student_id === selectedStudentId);
            if (!savedRes?.id || !selectedStudentId) return null;
            const reportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/report/student/${selectedStudentId}`;

            return (
              <>
                <a
                  href={`/report/student/${selectedStudentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#161922] hover:bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition"
                >
                  <ExternalLink size={15} /> 성적표 보기
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(reportUrl);
                    alert('학부모 성적표 링크가 복사되었습니다! 카톡이나 문자에 붙여넣기 하세요.');
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition"
                >
                  <Share2 size={15} /> 성적표 링크 복사
                </button>
              </>
            );
          })()}
              </div>
            </div>

            {/* 문항별 답안 입력 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedExam.questions.map((q, idx) => {
                const isActive = idx === activeQIndex;
                const val = currentAnswers[String(q.num)] || '';
                const isCorrect =
                  val.trim() !== '' &&
                  normalizeAnswer(val) === normalizeAnswer(q.answer || '');

                return (
                  <div
                    key={q.num}
                    onClick={() => setActiveQIndex(idx)}
                    className={`p-3.5 rounded-xl border transition ${
                      isActive ? 'ring-2 ring-blue-500 border-blue-500 ' : ''
    }${
                      val === ''
                        ? 'bg-[#0f1117] border-gray-800'
                        : isCorrect
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-rose-950/20 border-rose-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{q.num}번</span>
                        <span className="text-[11px] text-gray-400">({q.score}점)</span>
                        {q.unit && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                            {q.unit}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500">정답: {q.answer}</span>
                        {val !== '' &&
                          (isCorrect ? (
                            <CheckCircle2 size={15} className="text-emerald-400" />
                          ) : (
                            <XCircle size={15} className="text-rose-400" />
                          ))}
                      </div>
                    </div>

                    {q.type === 'mcq' ? (
                      <div className="flex gap-1.5">
                       {['1', '2', '3', '4', '5'].map((opt) => {
                  const selectedList = val
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const isSelected = selectedList.includes(opt);

                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setCurrentAnswers((prev) => ({
                          ...prev,
                          [String(q.num)]: toggleMcqOption(
                            prev[String(q.num)] || '',
                            opt,
                            q.answer || ''
                          ),
                        }))
                      }
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                        isSelected
                          ? isCorrect
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-[#161922] border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          setCurrentAnswers((prev) => ({
                            ...prev,
                            [String(q.num)]: e.target.value,
                          }))
                        }
                        placeholder="주관식 답안 입력"
                        className="w-full bg-[#161922] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="bg-[#161922] border border-gray-800 rounded-xl p-12 text-center text-gray-400 text-sm">
          오른쪽 위 <strong>+ 새 시험지 업로드</strong> 버튼을 눌러 첫 시험지를 만들어 보세요!
        </div>
      )}

      {/* 시험지 생성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveExam}
            className="bg-[#161922] border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingExamId ? '시험지 · 정답지 수정' : '새 시험지 업로드'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                닫기 ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* 시험지 파일 업로드 영역 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">시험지 파일 첨부 (PDF / 이미지)</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-4 cursor-pointer bg-[#0f1117] transition">
                  <Upload size={20} className="text-blue-400 mb-1.5" />
                  <span className="text-xs text-gray-300 font-medium">
                    {selectedFile
                      ? `선택된 파일: ${selectedFile.name}`
                      : existingFileUrl
                      ? '기존 파일이 첨부되어 있습니다 (클릭하여 새 파일로 교체)'
                      : '클릭하여 시험지 PDF 또는 이미지 선택'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {selectedFile && selectedFile.name.toLowerCase().endsWith('.pdf') && (
  <button
    type="button"
    onClick={() => setShowCropper(true)}
    className="mt-2 w-full py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 rounded-lg text-xs font-semibold transition"
  >
    ✨ PDF 문항 자동 캡처 & 미주 정답 추출 열기
  </button>
)}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">시험지 제목 *</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="예: 26-2기말 주간T #3_분당"
                    className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>               
              </div>

              {/* 문항 수 설정 */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f1117] border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">문항 수:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={questionCount}
                    onChange={(e) => syncQuestionCount(Number(e.target.value))}
                    className="w-16 bg-[#161922] border border-gray-700 rounded px-2 py-1 text-sm text-white text-center"
                  />
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => syncQuestionCount(n)}
                      className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                    >
                      {n}문항
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={bulkScore}
                  onChange={(e) => setBulkScore(e.target.value)}
                  placeholder="배점"
                  className="w-16 bg-[#161922] border border-gray-700 rounded-lg px-2 py-1 text-xs text-white text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = Number(bulkScore);
                    if (isNaN(val) || val < 0) return;
                    setDraftQuestions((prev) =>
                      prev.map((q) => ({ ...q, score: val }))
                    );
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition"
                >
                  일괄 적용
                </button>
              </div>
              <button
                type="button"
                onClick={handleDistribute100}
                className="text-xs px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition"
              >
                100점 균등 배분
              </button>
            </div>
              </div>
{(() => {
            const sum = draftQuestions.reduce(
              (acc, q) => acc + (Number(q.score) || 0),
              0
            );
            const base = sum > 0 && sum < 100 ? 100 - sum : 0;
            return (
              <div className="text-[11px] text-gray-400">
                문항 배점 합계:{' '}
                <span className="text-white font-semibold">{sum}점</span>
                {base > 0 && (
                  <span className="text-emerald-400 ml-2">
                    (기본점수 +{base}점 자동 반영 → 만점 100점)
                  </span>
                )}
              </div>
            );
          })()}

              {/* 정답 빠른 일괄 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickAnswerStr}
                  onChange={(e) => setQuickAnswerStr(e.target.value)}
                  placeholder="정답 빠른 일괄 입력 (예: 3142513245)"
                  className="flex-1 bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleApplyQuickAnswers}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-3 py-2 rounded-lg"
                >
                  일괄 적용
                </button>
              </div>

              {/* 문항별 설정 리스트 */}
              <div className="space-y-2">
                {draftQuestions.map((q, idx) => (
                  <div
                    key={q.num}
                    className="grid grid-cols-12 gap-2 items-center bg-[#0f1117] border border-gray-800 rounded-lg p-2 text-xs"
                  >
                    <div className="col-span-2 font-bold text-gray-300 pl-1">{q.num}번</div>
                    <select
                      value={q.type}
                      onChange={(e) =>
                        setDraftQuestions((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, type: e.target.value as 'mcq' | 'short' } : item
                          )
                        )
                      }
                      className="col-span-3 bg-[#161922] border border-gray-700 rounded px-2 py-1 text-white"
                    >
                      <option value="mcq">객관식</option>
                      <option value="short">주관식</option>
                    </select>
                    <input
                      type="text"
                      value={q.answer}
                      onChange={(e) =>
                        setDraftQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, answer: e.target.value } : item))
                        )
                      }
                      placeholder="정답"
                      className="col-span-2 bg-[#161922] border border-gray-700 rounded px-2 py-1 text-white text-center"
                    />
                    <input
                      type="number"
                      value={q.score}
                      onChange={(e) =>
                        setDraftQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, score: Number(e.target.value) } : item))
                        )
                      }
                      placeholder="배점"
                      className="col-span-2 bg-[#161922] border border-gray-700 rounded px-2 py-1 text-white text-center"
                    />
                    <input
                      type="text"
                      value={q.unit}
                      onChange={(e) =>
                        setDraftQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, unit: e.target.value } : item))
                        )
                      }
                      placeholder="단원명 (선택)"
                      className="col-span-3 bg-[#161922] border border-gray-700 rounded px-2 py-1 text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
              >
                {uploading ? '업로드 및 저장 중...' : '시험지 저장'}
              </button>
            </div>
          </form>
        </div>
      )}
      {showCropper && selectedFile && (
  <PdfQuestionCropper
    file={selectedFile}
    onClose={() => setShowCropper(false)}
    onComplete={(results: CroppedQuestionResult[]) => {
      setQuestionCount(results.length);
      setDraftQuestions((prev) =>
        results.map((r) => {
          const existing = prev.find((q) => q.num === r.num);
          return {
            num: r.num,
            type: existing?.type || 'mcq',
            answer: r.answer || existing?.answer || '',
            score: existing?.score ?? 5,
            unit: existing?.unit || '',
            image_url: r.image_url,
          };
        })
      );
      setShowCropper(false);
      alert(`${results.length}개 문항 이미지와 정답이 자동 적용되었습니다!`);
    }}
  />
)}
    </div>
  );
}
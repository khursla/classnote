'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  FileText,
  UserPlus,
  X,
  Search,
  Download,
} from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  subject: string;
  grade: string;
  status: string;
}

interface StudentItem {
  id: string;
  name: string;
  school: string;
  grade: string;
  student_phone?: string;
  parent_phone?: string;
  memo?: string;
}

interface SessionItem {
  id: string;
  class_id: string;
  session_no: number;
  session_date: string;
  topic: string;
  memo?: string | null;
  exam_id?: string | null;
}

interface ExamSummary {
  id: string;
  title: string;
  created_at: string;
  resultCount: number;
  avgScore: number | null;
}

export default function Home() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('고1통합과학');
  const [grade, setGrade] = useState('고1');
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [showAddStudents, setShowAddStudents] = useState(false);
  // 펼쳐진 반 상세 상태
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'sessions' | 'exams'>('students');
  const [detailLoading, setDetailLoading] = useState(false);

  const [allStudents, setAllStudents] = useState<StudentItem[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionNo, setSessionNo] = useState(1);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionMemo, setSessionMemo] = useState('');
  const [selectedSessionExamId, setSelectedSessionExamId] = useState<string>('');
  const [classExams, setClassExams] = useState<ExamSummary[]>([]);

  const fetchClasses = async () => {
    setLoading(true);
    let query = supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false });

   if (profile?.id && (profile.role === 'teacher' || !showAllTeachers)) {
      query = query.eq('teacher_id', profile.id);
    }
    const { data, error } = await query;
    if (!error && data) setClasses(data);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) {
      fetchClasses();
    }
  }, [profile, showAllTeachers]);
  const fetchClassDetails = async (classId: string) => {
    setDetailLoading(true);

    let allStuQuery = supabase
      .from('students')
      .select('id, name, school, grade, parent_phone, student_phone')
      .order('name', { ascending: true });

    if (profile?.role === 'teacher' || (profile?.id && !showAllTeachers)) {
      allStuQuery = allStuQuery.eq('teacher_id', profile.id);
    }

    const [allStuRes, enrollRes, sessRes, examRes] = await Promise.all([
      allStuQuery,
      supabase
        .from('class_students')
        .select('student_id, students(id, name, school, grade, parent_phone, student_phone)')
        .eq('class_id', classId),
      supabase
        .from('class_sessions')
        .select('*')
        .eq('class_id', classId)
        .order('session_no', { ascending: true }),
      profile?.id
          ? supabase
              .from('exams')
              .select('id, title, created_at')
              .eq('teacher_id', profile.id)
              .order('created_at', { ascending: false })
          : supabase
              .from('exams')
              .select('id, title, created_at')
              .order('created_at', { ascending: false }),
    ]);

    if (allStuRes.data) setAllStudents(allStuRes.data as StudentItem[]);

    if (enrollRes.data) {
      const list = enrollRes.data
        .map((row: any) => row.students)
        .filter(Boolean) as StudentItem[];
      setEnrolledStudents(list);
    } else {
      setEnrolledStudents([]);
    }

    if (sessRes.data) {
      const sList = sessRes.data as SessionItem[];
      setSessions(sList);
      setSessionNo(sList.length > 0 ? Math.max(...sList.map((s) => s.session_no)) + 1 : 1);
    } else {
      setSessions([]);
      setSessionNo(1);
    }

    if (examRes.data && examRes.data.length > 0) {
      const examIds = examRes.data.map((e: any) => e.id);
      const { data: resData } = await supabase
        .from('exam_results')
        .select('exam_id, score')
        .in('exam_id', examIds);

      const summaries: ExamSummary[] = examRes.data.map((ex: any) => {
        const rows = (resData || []).filter((r: any) => r.exam_id === ex.id);
        const avg =
          rows.length > 0
            ? Math.round((rows.reduce((sum: number, r: any) => sum + Number(r.score || 0), 0) / rows.length) * 10) / 10
            : null;
        return {
          id: ex.id,
          title: ex.title,
          created_at: ex.created_at,
          resultCount: rows.length,
          avgScore: avg,
        };
      });
      setClassExams(summaries);
    } else {
      setClassExams([]);
    }

    setDetailLoading(false);
  };

  const handleToggleClass = (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      return;
    }
    setExpandedClassId(classId);
    setActiveTab('students');
    setSelectedStudentIds([]);
    setStudentSearch('');
    fetchClassDetails(classId);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase
      .from('classes')
      .insert([{ name: name.trim(), subject, grade, status: '진행중', teacher_id: profile?.id }]);
    if (error) alert('저장 실패: ' + error.message);
    else {
      setName('');
      fetchClasses();
    }
  };

  const handleDeleteClass = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('이 클래스를 삭제할까요?')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) {
      if (expandedClassId === id) setExpandedClassId(null);
      fetchClasses();
    }
  };

  // 체크박스 개별 토글
  const handleToggleStudentCheck = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // 선택한 학생 일괄 추가
  const handleAddStudentsToClass = async (classId: string) => {
    if (selectedStudentIds.length === 0) return;
    const payload = selectedStudentIds.map((studentId) => ({
      class_id: classId,
      student_id: studentId,
    }));
    const { error } = await supabase.from('class_students').insert(payload);
    if (error) {
      alert('추가 실패: ' + error.message);
      return;
    }
    setSelectedStudentIds([]);
    setStudentSearch('');
    fetchClassDetails(classId);
  };

  const handleRemoveStudentFromClass = async (classId: string, studentId: string) => {
    const { error } = await supabase
      .from('class_students')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);
    if (!error) fetchClassDetails(classId);
  };

  const handleAddSession = async (e: React.FormEvent, classId: string) => {
    e.preventDefault();
    if (!sessionTopic.trim()) return;
    const { error } = await supabase.from('class_sessions').insert([
      {
        class_id: classId,
        session_no: Number(sessionNo) || 1,
        session_date: sessionDate,
        topic: sessionTopic.trim(),
        memo: sessionMemo.trim() || null,
        exam_id: selectedSessionExamId || null,
      },
    ]);
    if (error) {
      alert('회차 저장 실패: ' + error.message);
      return;
    }
    setSessionTopic('');
    setSessionMemo('');
    setSelectedSessionExamId('');
    fetchClassDetails(classId);
  };

  const handleDeleteSession = async (classId: string, sessionId: string) => {
    const { error } = await supabase.from('class_sessions').delete().eq('id', sessionId);
    if (!error) fetchClassDetails(classId);
  };
const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionNo, setEditSessionNo] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionTopic, setEditSessionTopic] = useState('');
  const [editSessionMemo, setEditSessionMemo] = useState('');
  const [editSessionExamId, setEditSessionExamId] = useState('');

  // 회차별 문자 발송용 성적표 엑셀 다운로드
  const handleDownloadSmsExcel = async (cls: any, session: any) => {
    if (!session?.exam_id) {
      return alert('이 회차에 연동된 시험지가 없습니다.');
    }

    const [resData, csData, examData] = await Promise.all([
      supabase
        .from('exam_results')
        .select('student_id, score')
        .eq('exam_id', session.exam_id),
      supabase
        .from('class_students')
        .select('student_id')
        .eq('class_id', cls.id),
      supabase
        .from('exams')
        .select('title')
        .eq('id', session.exam_id)
        .single(),
    ]);

    const allGraded = (resData.data || []).filter(
      (r: any) => r.score !== null && r.score !== undefined
    );

    if (allGraded.length === 0) {
      return alert('아직 채점 저장된 학생 성적이 없습니다.');
    }

    const enrolledSet = new Set((csData.data || []).map((c: any) => c.student_id));
    const classGraded = allGraded.filter((r: any) => enrolledSet.has(r.student_id));
    const targetRows = classGraded.length > 0 ? classGraded : allGraded;

    const totalScore = targetRows.reduce((acc: number, r: any) => acc + Number(r.score), 0);
    const avgScore = Math.round((totalScore / targetRows.length) * 10) / 10;

    const targetIds = targetRows.map((r: any) => r.student_id);
    const { data: stuList } = await supabase
      .from('students')
      .select('id, name, phone, parent_phone')
      .in('id', targetIds);

    const stuMap = new Map((stuList || []).map((st: any) => [st.id, st]));
    const examTitle = examData.data?.title || `${session.session_no}회차 시험`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://classnote-rosy.vercel.app';

    const excelRows: any[] = [];

    targetRows.forEach((r: any) => {
      const stu = stuMap.get(r.student_id);
      if (!stu) return;

      const reportUrl = `${origin}/report/student/${stu.id}`;
      const rawPhones = String(stu.parent_phone || stu.phone || '');
      const splitPhones = rawPhones
        .split(/[,/\n;]+/)
        .map((p) => p.replace(/\([^)]*\)/g, '').replace(/[^0-9-]/g, '').trim())
        .filter((p) => p.replace(/-/g, '').length >= 9);

      const phonesToUse = splitPhones.length > 0 ? splitPhones : [''];

      phonesToUse.forEach((phoneNum) => {
        excelRows.push({
          학생명: stu.name,
          수신번호: phoneNum,
          시험명: examTitle,
          점수: r.score,
          반평균: avgScore,
          성적표링크: reportUrl,
        });
      });
    });

    excelRows.sort((a, b) => a.학생명.localeCompare(b.학생명, 'ko'));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '문자발송');

    const safeClassName = String(cls.name || '클래스').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(workbook, `${safeClassName}_${session.session_no}회차_문자발송용.xlsx`);
  };

  const startEditSession = (s: any) => {
    setEditingSessionId(s.id);
    setEditSessionNo(String(s.session_no || 1));
    setEditSessionDate(s.session_date || '');
    setEditSessionTopic(s.topic || '');
    setEditSessionMemo(s.memo || '');
    setEditSessionExamId(s.exam_id || '');
  };

  const handleUpdateSession = async (classId: string, sessionId: string) => {
    if (!editSessionTopic.trim()) {
      alert('진도사항을 입력해 주세요.');
      return;
    }
    const { error } = await supabase
      .from('class_sessions')
      .update({
        session_no: Number(editSessionNo) || 1,
        session_date: editSessionDate,
        topic: editSessionTopic.trim(),
        memo: editSessionMemo.trim() || null,
        exam_id: editSessionExamId || null,
      })
      .eq('id', sessionId);

    if (error) {
      alert('회차 수정 실패: ' + error.message);
      return;
    }
    setEditingSessionId(null);
    fetchClassDetails(classId);
  };

  const availableStudents = allStudents.filter(
    (st) => !enrolledStudents.some((en) => en.id === st.id)
  );

  const filteredAvailableStudents = availableStudents.filter((st) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      st.name?.toLowerCase().includes(q) ||
      st.school?.toLowerCase().includes(q) ||
      st.grade?.toLowerCase().includes(q)
    );
  });

  const allFilteredSelected =
    filteredAvailableStudents.length > 0 &&
    filteredAvailableStudents.every((st) => selectedStudentIds.includes(st.id));

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredAvailableStudents.map((s) => s.id));
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const merged = new Set([
        ...selectedStudentIds,
        ...filteredAvailableStudents.map((s) => s.id),
      ]);
      setSelectedStudentIds(Array.from(merged));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          운영 중인 클래스를 등록하고 관리합니다. 반명을 클릭하면 수강생·회차·시험 정보를 확인할 수 있습니다.
        </p>
<div className="flex items-center gap-2">
          {profile?.role !== 'teacher' && (
            <button
              type="button"
              onClick={() => setShowAllTeachers((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                showAllTeachers
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-[#161922] border-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              {showAllTeachers ? '전체 강사 반 보는 중' : '내 반만 보기'}
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            <CheckCircle2 size={14} /> DB 연결됨
          </div>
        </div>
      </div>

      {/* 새 클래스 추가 폼 */}
      <form
        onSubmit={handleAddClass}
        className="bg-[#161922] border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-end"
      >
        <div className="flex-1 w-full">
          <label className="block text-xs text-gray-400 mb-1.5">클래스명</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 26-2기말대비 고1통과_분당"
            className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="w-full md:w-40">
          <label className="block text-xs text-gray-400 mb-1.5">과목</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="고1통합과학">고1통합과학</option>
            <option value="고2지구과학">고2지구과학</option>
            <option value="지구시스템과학">지구시스템과학</option>
            <option value="중등과학">중등과학</option>
          </select>
        </div>
        <div className="w-full md:w-28">
          <label className="block text-xs text-gray-400 mb-1.5">학년</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="고1">고1</option>
            <option value="고2">고2</option>
            <option value="고3">고3</option>
            <option value="중등">중등</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full md:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
        >
          <Plus size={16} /> 클래스 추가
        </button>
      </form>

      {/* 클래스 목록 */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">클래스 목록을 불러오는 중...</div>
      ) : classes.length === 0 ? (
        <div className="bg-[#161922] border border-gray-800 rounded-xl p-10 text-center text-sm text-gray-400">
          등록된 클래스가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => {
            const isOpen = expandedClassId === cls.id;
            return (
              <div
                key={cls.id}
                className="bg-[#161922] border border-gray-800 rounded-xl overflow-hidden transition"
              >
                {/* 반 카드 헤더 (클릭 시 펼침) */}
                <div
                  onClick={() => handleToggleClass(cls.id)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-800/30 transition"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-base font-bold text-white">{cls.name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                      {cls.status}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-300">
                      {cls.subject}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-300">
                      {cls.grade}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleDeleteClass(e, cls.id)}
                      className="text-gray-500 hover:text-rose-400 transition p-1"
                      title="클래스 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                    {isOpen ? (
                      <ChevronUp size={18} className="text-blue-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* 펼쳐진 상세 영역 */}
                {isOpen && (
                  <div className="border-t border-gray-800 bg-[#0f1117]/70 p-5 space-y-5">
                    {/* 탭 버튼 */}
                    <div className="flex gap-2 border-b border-gray-800 pb-3">
                      <button
                        onClick={() => setActiveTab('students')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'students'
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#161922] text-gray-400 hover:text-white'
                          }`}
                      >
                        <Users size={14} /> 수강생 ({enrolledStudents.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('sessions')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'sessions'
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#161922] text-gray-400 hover:text-white'
                          }`}
                      >
                        <Calendar size={14} /> 수업 회차 ({sessions.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('exams')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'exams'
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#161922] text-gray-400 hover:text-white'
                          }`}
                      >
                        <FileText size={14} /> 시험 정보 ({classExams.length})
                      </button>
                    </div>

                    {detailLoading ? (
                      <div className="text-xs text-gray-400 py-6 text-center">불러오는 중...</div>
                    ) : (
                      <>
                        {/* 탭 1: 수강생 목록 + 체크박스 일괄 추가 */}
                        {activeTab === 'students' && (
                          <div className="space-y-5">
                            {/* 일괄 추가 영역 */}
                            <button
                              type="button"
                              onClick={() => setShowAddStudents((prev) => !prev)}
                              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#161922] hover:bg-[#1e2230] border border-gray-800 rounded-xl text-xs font-medium text-gray-200 transition"
                            >
                              <span className="flex items-center gap-2">
                                <UserPlus size={14} className="text-blue-400" />
                                수강생 추가하기 ({filteredAvailableStudents.length}명 추가 가능)
                              </span>
                              <span className="text-gray-400">{showAddStudents ? '접기 ▲' : '펼치기 ▼'}</span>
                            </button>

                            {showAddStudents && (
                              <div className="bg-[#161922] border border-gray-800 rounded-xl p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="relative flex-1">
                                    <Search
                                      size={14}
                                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    />
                                    <input
                                      type="text"
                                      value={studentSearch}
                                      onChange={(e) => setStudentSearch(e.target.value)}
                                      placeholder="추가할 학생 이름·학교 검색..."
                                      className="w-full bg-[#0f1117] border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={handleToggleSelectAllFiltered}
                                      disabled={filteredAvailableStudents.length === 0}
                                      className="px-3 py-1.5 bg-[#0f1117] border border-gray-700 hover:border-gray-500 disabled:opacity-40 text-xs text-gray-200 rounded-lg transition"
                                    >
                                      {allFilteredSelected ? '전체 해제' : '전체 선택'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAddStudentsToClass(cls.id)}
                                      disabled={selectedStudentIds.length === 0}
                                      className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                                    >
                                      <UserPlus size={14} />
                                      {selectedStudentIds.length > 0
                                        ? `선택한 ${selectedStudentIds.length}명 추가`
                                        : '수강생 추가'}
                                    </button>
                                  </div>
                                </div>

                                {filteredAvailableStudents.length === 0 ? (
                                  <div className="text-xs text-gray-500 py-3 text-center">
                                    추가 가능한 학생이 없습니다.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                                    {filteredAvailableStudents.map((st) => {
                                      const checked = selectedStudentIds.includes(st.id);
                                      return (
                                        <label
                                          key={st.id}
                                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition select-none ${checked
                                              ? 'bg-blue-600/20 border-blue-500 text-white'
                                              : 'bg-[#0f1117] border-gray-800 text-gray-300 hover:border-gray-600'
                                            }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => handleToggleStudentCheck(st.id)}
                                            className="accent-blue-500 w-3.5 h-3.5 shrink-0"
                                          />
                                          <div className="truncate">
                                            <div className="font-medium truncate">{st.name}</div>
                                            <div className="text-[10px] text-gray-400 truncate">
                                              {st.school || '-'} · {st.grade || '-'}
                                            </div>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* 현재 등록된 수강생 목록 */}
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-gray-400">
                                현재 등록된 수강생 ({enrolledStudents.length}명)
                              </div>
                              {enrolledStudents.length === 0 ? (
                                <div className="text-xs text-gray-500 py-4 text-center">
                                  아직 등록된 수강생이 없습니다. 위에서 학생을 체크해 추가해 보세요.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {enrolledStudents.map((st) => (
                                    <div
                                      key={st.id}
                                      className="bg-[#161922] border border-gray-800 rounded-lg px-3.5 py-2.5 flex items-center justify-between"
                                    >
                                      <div
                                        onClick={() => setSelectedStudent(st)}
                                        className="flex-1 cursor-pointer hover:opacity-80 transition"
                                      >
                                        <div className="text-sm font-medium text-white">{st.name}</div>
                                        <div className="text-[11px] text-gray-400">
                                          {st.school} · {st.grade}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveStudentFromClass(cls.id, st.id)}
                                        className="text-gray-500 hover:text-rose-400 p-1"
                                        title="이 반에서 제외"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 탭 2: 수업 회차 정보 */}
                        {activeTab === 'sessions' && (
                          <div className="space-y-4">
                            <form
                              onSubmit={(e) => handleAddSession(e, cls.id)}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2"
                            >
                              <input
                                type="number"
                                min={1}
                                value={sessionNo}
                                onChange={(e) => setSessionNo(Number(e.target.value))}
                                placeholder="회차"
                                className="sm:col-span-2 bg-[#161922] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                              />
                              <input
                                type="date"
                                value={sessionDate}
                                onChange={(e) => setSessionDate(e.target.value)}
                                className="sm:col-span-3 bg-[#161922] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                              />
                              <input
                                type="text"
                                value={sessionTopic}
                                onChange={(e) => setSessionTopic(e.target.value)}
                                placeholder="수업 진도 / 주제 (예: 산화환원 반응)"
                                className="sm:col-span-4 bg-[#161922] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                              />
                              <input
                                type="text"
                                value={sessionMemo}
                                onChange={(e) => setSessionMemo(e.target.value)}
                                placeholder="과제 / 메모 (선택)"
                                className="sm:col-span-2 bg-[#161922] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                              />
                              <select
        value={selectedSessionExamId}
        onChange={(e) => setSelectedSessionExamId(e.target.value)}
        className="sm:col-span-2 bg-[#161922] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"
      >
        <option value="">연동 시험지 없음 (선택)</option>
        {classExams.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.title}
          </option>
        ))}
      </select>
                              <button
                                type="submit"
                                className="sm:col-span-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg py-2 transition"
                              >
                                추가
                              </button>
                            </form>

                            {sessions.length === 0 ? (
                              <div className="text-xs text-gray-500 py-4 text-center">
                                등록된 수업 회차가 없습니다.
                              </div>
                            ) : (
                              <div className="space-y-2">
                               {sessions.map((s) =>
                      editingSessionId === s.id ? (
                        <div
                          key={s.id}
                          className="bg-[#161922] border border-blue-500/50 rounded-lg p-3 space-y-2"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <input
                              type="number"
                              value={editSessionNo}
                              onChange={(e) => setEditSessionNo(e.target.value)}
                              placeholder="회차"
                              className="sm:col-span-2 bg-[#0f1117] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                            <input
                              type="date"
                              value={editSessionDate}
                              onChange={(e) => setEditSessionDate(e.target.value)}
                              className="sm:col-span-3 bg-[#0f1117] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={editSessionTopic}
                              onChange={(e) => setEditSessionTopic(e.target.value)}
                              placeholder="이번 주 진도사항 (성적표 표시)"
                              className="sm:col-span-4 bg-[#0f1117] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={editSessionMemo}
                              onChange={(e) => setEditSessionMemo(e.target.value)}
                              placeholder="공지사항 (성적표 표시)"
                              className="sm:col-span-3 bg-[#0f1117] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <select
                              value={editSessionExamId}
                              onChange={(e) => setEditSessionExamId(e.target.value)}
                              className="bg-[#0f1117] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-200"
                            >
                              <option value="">연결 시험 없음</option>
                              {classExams.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.title}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingSessionId(null)}
                                className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateSession(cls.id, s.id)}
                                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={s.id}
                          className="bg-[#161922] border border-gray-800 rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                              {s.session_no}회차
                            </span>
                            <span className="text-xs text-gray-400">{s.session_date}</span>
                            <span className="text-sm font-medium text-white">{s.topic}</span>
                            {s.memo && (
                              <span className="text-xs text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded">
                                공지: {s.memo}
                              </span>
                            )}
                            {(() => {
                              const linkedExam = classExams.find((ex) => ex.id === s.exam_id);
                              return linkedExam ? (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                                  시험: {linkedExam.title}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {s.exam_id && (
                    <button
                      type="button"
                      onClick={() => handleDownloadSmsExcel(cls, s)}
                      className="text-xs bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 px-2.5 py-1 rounded-md flex items-center gap-1 mr-1 transition"
                      title="채점 완료된 수강생의 문자 발송용 엑셀 다운로드"
                    >
                      <Download size={12} />
                      문자용 엑셀
                    </button>
                  )}
                            <button
                              type="button"
                              onClick={() => startEditSession(s)}
                              className="text-xs text-gray-400 hover:text-blue-400 px-2 py-1 rounded hover:bg-gray-800 transition"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(cls.id, s.id)}
                              className="text-gray-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 탭 3: 시험 정보 */}
                        {activeTab === 'exams' && (
                          <div className="space-y-3">
                            {classExams.length === 0 ? (
                              <div className="text-xs text-gray-500 py-4 text-center">
                                이 반에 등록된 시험이 없습니다.{' '}
                                <Link href="/exams" className="text-blue-400 underline">
                                  문제지 · 자동채점
                                </Link>
                                에서 시험을 등록해 주세요.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {classExams.map((ex) => (
                                  <div
                                    key={ex.id}
                                    className="bg-[#161922] border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="text-sm font-semibold text-white">{ex.title}</div>
                                      <div className="text-xs text-gray-400 mt-0.5">
                                        등록일: {new Date(ex.created_at).toLocaleDateString('ko-KR')}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="text-xs text-gray-400">응시 {ex.resultCount}명</div>
                                        <div className="text-sm font-bold text-blue-400">
                                          {ex.avgScore !== null ? `평균 ${ex.avgScore}점` : '미채점'}
                                        </div>
                                      </div>
                                      <Link
                                        href="/exams"
                                        className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition"
                                      >
                                        채점 이동
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* 학생 상세 정보 모달 */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="w-full max-w-md bg-[#161922] border border-gray-700 rounded-2xl p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedStudent.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedStudent.school} · {selectedStudent.grade}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-[#0f1117] border border-gray-800 rounded-xl p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">학생 연락처</span>
                <span className="text-gray-200">{selectedStudent.student_phone || '미등록'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">학부모 연락처</span>
                <span className="text-gray-200">{selectedStudent.parent_phone || '미등록'}</span>
              </div>
              <div className="pt-2 border-t border-gray-800">
                <div className="text-xs text-gray-400 mb-1">메모</div>
                <div className="text-gray-200 whitespace-pre-wrap text-xs">
                  {selectedStudent.memo || '등록된 메모가 없습니다.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={`/report/student/${selectedStudent.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-lg transition"
              >
                누적 성적표 보기
              </a>
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
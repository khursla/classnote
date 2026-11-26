'use client';

import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import {
    Plus,
    Trash2,
    Pencil,
    Check,
    Upload,
    Download,
    Search,
    X,
    Award,
    BookOpen,
    TrendingUp,
    Phone,
    FileCheck2,
    Link2,
    MessageSquare,
} from 'lucide-react';

interface Student {
    id: string;
    name: string;
    school: string;
    grade: string;
    parent_phone: string;
    student_phone: string;
    is_active: boolean;
}

interface EnrolledClass {
    id: string;
    name: string;
    subject: string;
    grade: string;
}

interface StudentExamResult {
    id: string;
    score: number;
    wrong_numbers: number[] | null;
    created_at: string;
    exams: {
        id: string;
        title: string;
    } | null;
}

export default function StudentsPage() {
    const { profile } = useAuth();
    const [students, setStudents] = useState<Student[]>([]);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({
        name: '',
        school: '',
        grade: '고1',
        parent_phone: '',
        student_phone: '',
    });

    // 학생 정보 인라인 수정 상태
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        school: '',
        grade: '고1',
        parent_phone: '',
        student_phone: '',
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 선택된 학생 상세 모달 상태
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
    const [examResults, setExamResults] = useState<StudentExamResult[]>([]);

    const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [classList, setClassList] = useState<
    { id: string; name: string; subject?: string; grade?: string; teacher_id?: string }[]
  >([]);
  const [classLinks, setClassLinks] = useState<{ class_id: string; student_id: string }[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [uploadClassId, setUploadClassId] = useState<string>('');

  const fetchStudents = async () => {
    const [studentRes, classRes, linkRes] = await Promise.all([
      supabase.from('students').select('*').order('name', { ascending: true }),
      supabase
        .from('classes')
        .select('id, name, subject, grade, teacher_id')
        .order('created_at', { ascending: false }),
      supabase.from('class_students').select('class_id, student_id'),
    ]);

    if (!studentRes.error && studentRes.data) {
      setStudents(studentRes.data as Student[]);
    }
    if (!classRes.error && classRes.data) {
      setClassList(classRes.data);
    }
    if (!linkRes.error && linkRes.data) {
      setClassLinks(linkRes.data);
    }
  };

  useEffect(() => {
    if (profile) fetchStudents();
  }, [profile]);

    // 학생 클릭 시 수강 클래스 + 시험 성적 불러오기
    const handleSelectStudent = async (student: Student) => {
        setSelectedStudent(student);
        setDetailLoading(true);

        const [classRes, examRes] = await Promise.all([
            supabase
                .from('class_students')
                .select('classes(id, name, subject, grade)')
                .eq('student_id', student.id),
            supabase
                .from('exam_results')
                .select('id, score, wrong_numbers, created_at, exams(id, title)')
                .eq('student_id', student.id)
                .order('created_at', { ascending: true }),
        ]);

        if (classRes.data) {
            const list = classRes.data
                .map((row: any) => row.classes)
                .filter(Boolean) as EnrolledClass[];
            setEnrolledClasses(list);
        } else {
            setEnrolledClasses([]);
        }

        if (examRes.data) {
            setExamResults(examRes.data as unknown as StudentExamResult[]);
        } else {
            setExamResults([]);
        }

        setDetailLoading(false);
    };
    // 학생 수정 시작
    const handleStartEdit = (e: React.MouseEvent, st: Student) => {
        e.stopPropagation();
        setEditingId(st.id);
        setEditForm({
            name: st.name || '',
            school: st.school || '',
            grade: st.grade || '고1',
            parent_phone: st.parent_phone || '',
            student_phone: st.student_phone || '',
        });
    };

    // 학생 수정 취소
    const handleCancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
    };

    // 학생 수정 저장
    const handleSaveEdit = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!editForm.name.trim()) return alert('이름을 입력해 주세요.');

        const { error } = await supabase
            .from('students')
            .update({
                name: editForm.name.trim(),
                school: editForm.school.trim(),
                grade: editForm.grade,
                parent_phone: editForm.parent_phone.trim(),
                student_phone: editForm.student_phone.trim(),
            })
            .eq('id', id);

        if (error) {
            alert('수정 실패: ' + error.message);
        } else {
            setEditingId(null);
            fetchStudents();
        }
    };
    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('이름을 입력해 주세요.');

        const { error } = await supabase.from('students').insert([
            {
                name: form.name.trim(),
                school: form.school.trim(),
                grade: form.grade,
                parent_phone: form.parent_phone.trim(),
                student_phone: form.student_phone.trim(),
                is_active: true,
                teacher_id: profile?.id,
            },
        ]);

        if (error) {
            alert('추가 실패: ' + error.message);
        } else {
            setForm({ name: '', school: '', grade: '고1', parent_phone: '', student_phone: '' });
            fetchStudents();
        }
    };

    const handleDeleteStudent = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (!confirm(`'${name}' 학생을 삭제할까요?`)) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (!error) {
            if (selectedStudent?.id === id) setSelectedStudent(null);
            fetchStudents();
        }
    };

    // 엑셀 업로드
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const payload = rows
      .map((r) => ({
        name: String(r['이름'] || r['name'] || '').trim(),
        school: String(r['학교'] || r['school'] || '').trim(),
        grade: String(r['학년'] || r['grade'] || '고1').trim(),
        parent_phone: String(r['학부모 전화번호'] || r['학부모연락처'] || r['parent_phone'] || '').trim(),
        student_phone: String(r['학생 전화번호'] || r['학생연락처'] || r['student_phone'] || '').trim(),
        is_active: true,
        teacher_id: profile?.id,
      }))
      .filter((r) => r.name);

    if (payload.length === 0) {
      alert('엑셀에서 유효한 학생 데이터를 찾지 못했습니다. (열 이름: 이름, 학교, 학년 등)');
      e.target.value = '';
      return;
    }

    // 기존 동일 학생(이름 + 연락처 일치) 확인하여 중복 등록 방지
    const toInsert: typeof payload = [];
    const matchedStudentIds: string[] = [];

    payload.forEach((row) => {
      const existing = students.find(
        (s) =>
          s.name === row.name &&
          ((row.parent_phone && s.parent_phone === row.parent_phone) ||
            (row.student_phone && s.student_phone === row.student_phone) ||
            (!row.parent_phone && !row.student_phone))
      );
      if (existing) {
        matchedStudentIds.push(existing.id);
      } else {
        toInsert.push(row);
      }
    });

    let insertedIds: string[] = [];
    if (toInsert.length > 0) {
      const { data: insertedData, error } = await supabase
        .from('students')
        .insert(toInsert)
        .select('id');

      if (error) {
        alert('업로드 실패: ' + error.message);
        e.target.value = '';
        return;
      }
      insertedIds = (insertedData || []).map((item: { id: string }) => item.id);
    }

    const targetStudentIds = Array.from(new Set([...matchedStudentIds, ...insertedIds]));

    // 반이 선택된 경우 해당 반(class_students)에 자동 배정
    if (uploadClassId && targetStudentIds.length > 0) {
      const alreadyEnrolled = new Set(
        classLinks.filter((l) => l.class_id === uploadClassId).map((l) => l.student_id)
      );
      const newEnrollments = targetStudentIds
        .filter((sid) => !alreadyEnrolled.has(sid))
        .map((sid) => ({
          class_id: uploadClassId,
          student_id: sid,
        }));

      if (newEnrollments.length > 0) {
        const { error: enrollError } = await supabase
          .from('class_students')
          .insert(newEnrollments);

        if (enrollError) {
          alert(`학생 등록은 되었으나 반 배정 중 오류가 발생했습니다: ${enrollError.message}`);
          fetchStudents();
          e.target.value = '';
          return;
        }
      }

      const targetClass = classList.find((c) => c.id === uploadClassId);
      alert(
        `신규 ${insertedIds.length}명 등록 / 총 ${targetStudentIds.length}명이 [${targetClass?.name || '선택한 반'}]에 배정되었습니다.`
      );
    } else {
      alert(`${insertedIds.length}명의 학생이 등록되었습니다.`);
    }

    fetchStudents();
    e.target.value = '';
  };

  // 현재 표시 범위의 반 목록 (기본: 내 반만 / 전체 보기 시: 전체 반)
  const visibleClasses = showAllTeachers
    ? classList
    : classList.filter((c) => c.teacher_id === profile?.id);

  const visibleClassIds = new Set(visibleClasses.map((c) => c.id));
  const visibleClassStudentIds = new Set(
    classLinks.filter((l) => visibleClassIds.has(l.class_id)).map((l) => l.student_id)
  );
  const allEnrolledStudentIds = new Set(classLinks.map((l) => l.student_id));

  const filteredStudents = students.filter((s) => {
    // 1. 내 반 학생만 보기 필터 (반 미배정 신규 등록 학생 포함)
    if (!showAllTeachers) {
      const isInMyClass = visibleClassStudentIds.has(s.id);
      const isMyUnassigned = (s as any).teacher_id === profile?.id && !allEnrolledStudentIds.has(s.id);
      if (!isInMyClass && !isMyUnassigned) return false;
    }

    // 2. 특정 반 선택 필터
    if (selectedClassFilter !== 'all') {
      const inSelectedClass = classLinks.some(
        (l) => l.class_id === selectedClassFilter && l.student_id === s.id
      );
      if (!inSelectedClass) return false;
    }

    // 3. 검색어 필터
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name?.toLowerCase().includes(q) ||
      s.school?.toLowerCase().includes(q) ||
      s.parent_phone?.includes(q) ||
      s.student_phone?.includes(q)
    );
  });

  // 엑셀 내보내기 (현재 필터링된 학생 기준)
  const handleExcelDownload = () => {
    const exportData = filteredStudents.map((s) => ({
      이름: s.name,
      학교: s.school || '',
      학년: s.grade || '',
      '학부모 전화번호': s.parent_phone || '',
      '학생 전화번호': s.student_phone || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '학생명단');
    XLSX.writeFile(wb, 'ClassNote_학생명단.xlsx');
  };

    // 선택된 학생 성적 통계 계산
    const totalExams = examResults.length;
    const avgScore =
        totalExams > 0
            ? Math.round((examResults.reduce((sum, r) => sum + Number(r.score || 0), 0) / totalExams) * 10) / 10
            : 0;
    const maxScore =
        totalExams > 0 ? Math.max(...examResults.map((r) => Number(r.score || 0))) : 0;
    const latestScore =
        totalExams > 0 ? Number(examResults[examResults.length - 1].score || 0) : 0;
    const handleCopyReportLink = () => {
        if (!selectedStudent) return;
        const url = `${window.location.origin}/report/student/${selectedStudent.id}`;
        navigator.clipboard.writeText(url);
        alert('누적 성적표 링크가 복사되었습니다!\n' + url);
    };

    const handleCopyKakaoText = () => {
        if (!selectedStudent) return;
        const url = `${window.location.origin}/report/student/${selectedStudent.id}`;
        const latestExam = examResults.length > 0 ? examResults[examResults.length - 1] : null;
        const latestWrongs =
            latestExam && Array.isArray(latestExam.wrong_numbers) && latestExam.wrong_numbers.length > 0
                ? `${latestExam.wrong_numbers.join(', ')}번`
                : '없음 (만점)';

        const lines = [
            `[ClassNote 성적 안내]`,
            `학생명: ${selectedStudent.name} (${selectedStudent.school || ''} ${selectedStudent.grade || ''})`,
            ``,
            latestExam
                ? `■ 최근 시험: ${latestExam.exams?.title || '시험'} (${latestExam.score}점 / 오답: ${latestWrongs})`
                : `■ 최근 시험: 기록 없음`,
            `■ 누적 현황: 총 ${totalExams}회 응시 / 누적 평균 ${avgScore}점 (최고 ${maxScore}점)`,
            ``,
            `▶ 누적 및 회차별 상세 성적표 보기:`,
            url,
        ];

        navigator.clipboard.writeText(lines.join('\n'));
        alert('카톡 발송용 요약 문자가 복사되었습니다! 채팅창에 바로 붙여넣기(Ctrl+V) 하세요.');
    };
    return (
        <div className="space-y-5">
            {/* 상단 요약 + 필터 + 반별 엑셀 업로드 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-400">
              총 <span className="text-white font-semibold">{filteredStudents.length}</span>명의 수강생
            </p>

            {profile?.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setShowAllTeachers((prev) => !prev);
                  setSelectedClassFilter('all');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                  showAllTeachers
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                }`}
              >
                {showAllTeachers ? '전체 학생 보는 중' : '내 반 학생만 보기'}
              </button>
            )}

            {visibleClasses.length > 0 && (
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-[#161922] border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-200"
              >
                <option value="all">{showAllTeachers ? '전체 반 보기' : '내 반 전체'}</option>
                {visibleClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {visibleClasses.length > 0 && (
              <select
                value={uploadClassId}
                onChange={(e) => setUploadClassId(e.target.value)}
                className="bg-[#161922] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"
              >
                <option value="">업로드할 반 선택 (미선택 시 명단만 등록)</option>
                {visibleClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-lg text-xs transition ${
                uploadClassId
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/30'
                  : 'bg-[#161922] border-gray-700 hover:border-gray-500 text-gray-200'
              }`}
            >
              <Upload size={14} /> {uploadClassId ? '선택 반에 엑셀 업로드' : '엑셀 업로드'}
            </button>
            <button
              onClick={handleExcelDownload}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#161922] border border-gray-700 hover:border-gray-500 rounded-lg text-xs text-gray-200 transition"
            >
              <Download size={14} /> 엑셀 내보내기
            </button>
          </div>
        </div>

            {/* 학생 추가 폼 */}
            <form
                onSubmit={handleAddStudent}
                className="bg-[#161922] border border-gray-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
            >
                <input
                    type="text"
                    placeholder="이름 *"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <input
                    type="text"
                    placeholder="학교 (예: 분당고)"
                    value={form.school}
                    onChange={(e) => setForm({ ...form, school: e.target.value })}
                    className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <select
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                    <option value="중1">중1</option>
                    <option value="중2">중2</option>
                    <option value="중3">중3</option>
                </select>
                <input
                    type="text"
                    placeholder="학부모 전화번호"
                    value={form.parent_phone}
                    onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                    className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <input
                    type="text"
                    placeholder="학생 전화번호"
                    value={form.student_phone}
                    onChange={(e) => setForm({ ...form, student_phone: e.target.value })}
                    className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg py-2 transition"
                >
                    <Plus size={16} /> 추가
                </button>
            </form>

            {/* 검색바 */}
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="이름, 학교, 전화번호 검색..."
                    className="w-full bg-[#161922] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
            </div>

            {/* 학생 테이블 */}
            <div className="bg-[#161922] border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-800 text-xs text-gray-400 bg-[#0f1117]/60">
                                <th className="py-3.5 px-4 font-medium">이름</th>
                                <th className="py-3.5 px-4 font-medium">학교</th>
                                <th className="py-3.5 px-4 font-medium">학년</th>
                                <th className="py-3.5 px-4 font-medium">학부모 전화번호</th>
                                <th className="py-3.5 px-4 font-medium">학생 전화번호</th>
                                <th className="py-3.5 px-4 font-medium text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/70 text-sm">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-gray-500 text-xs">
                                        검색 결과가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((st) => {
                                    const isEditing = editingId === st.id;

                                    return (
                                        <tr
                                            key={st.id}
                                            onClick={() => !isEditing && handleSelectStudent(st)}
                                            className={`border-b border-gray-800/60 transition ${isEditing ? 'bg-blue-500/10' : 'hover:bg-blue-500/10 cursor-pointer'
                                                }`}
                                        >
                                            {isEditing ? (
                                                <>
                                                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={editForm.name}
                                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                            className="w-full bg-[#0f1117] border border-blue-500 rounded px-2 py-1 text-sm text-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={editForm.school}
                                                            onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                                                            className="w-full bg-[#0f1117] border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={editForm.grade}
                                                            onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                                                            className="bg-[#0f1117] border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                                        >
                                                            <option value="고1">고1</option>
                                                            <option value="고2">고2</option>
                                                            <option value="고3">고3</option>
                                                            <option value="중1">중1</option>
                                                            <option value="중2">중2</option>
                                                            <option value="중3">중3</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={editForm.parent_phone}
                                                            onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })}
                                                            className="w-full bg-[#0f1117] border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={editForm.student_phone}
                                                            onChange={(e) => setEditForm({ ...editForm, student_phone: e.target.value })}
                                                            className="w-full bg-[#0f1117] border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <button
                                                                onClick={(e) => handleSaveEdit(e, st.id)}
                                                                className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition"
                                                                title="저장"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition"
                                                                title="취소"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="py-3.5 px-4 font-semibold text-white">
                                                        <span className="hover:text-blue-400 underline-offset-4 hover:underline">
                                                            {st.name}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-gray-300">{st.school || '-'}</td>
                                                    <td className="py-3.5 px-4 text-gray-300">{st.grade || '-'}</td>
                                                    <td className="py-3.5 px-4 text-gray-300">{st.parent_phone || '-'}</td>
                                                    <td className="py-3.5 px-4 text-gray-300">{st.student_phone || '-'}</td>
                                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => handleStartEdit(e, st)}
                                                                className="text-gray-400 hover:text-blue-400 p-1.5 transition"
                                                                title="학생 정보 수정"
                                                            >
                                                                <Pencil size={15} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteStudent(e, st.id, st.name)}
                                                                className="text-gray-400 hover:text-rose-400 p-1.5 transition"
                                                                title="학생 삭제"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 학생 상세 정보 & 성적 모달 */}
            {selectedStudent && (
                <div
                    onClick={() => setSelectedStudent(null)}
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#161922] border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
                    >
                        {/* 모달 헤더 */}
                        <div className="sticky top-0 bg-[#161922] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Award className="text-blue-400" size={20} />
                                    {selectedStudent.name} 학생 상세 정보
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {selectedStudent.school || '학교 미입력'} · {selectedStudent.grade || '학년 미입력'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* 모달 본문 */}
                        <div className="p-6 space-y-6">
                            {/* 성적표 공유 버튼 2종 */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={handleCopyReportLink}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                                >
                                    <Link2 size={15} /> 누적 성적표 링크 복사
                                </button>
                                <button
                                    onClick={handleCopyKakaoText}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    <MessageSquare size={15} /> 카톡 발송용 문자 복사
                                </button>
                            </div>
                            {/* 연락처 & 수강 반 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-4 space-y-1.5">
                                    <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                                        <Phone size={13} className="text-blue-400" /> 연락처
                                    </div>
                                    <div className="text-xs text-gray-300">
                                        학부모: <span className="text-white">{selectedStudent.parent_phone || '-'}</span>
                                    </div>
                                    <div className="text-xs text-gray-300">
                                        학생: <span className="text-white">{selectedStudent.student_phone || '-'}</span>
                                    </div>
                                </div>

                                <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-4 space-y-2">
                                    <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                                        <BookOpen size={13} className="text-blue-400" /> 수강 중인 클래스
                                    </div>
                                    {detailLoading ? (
                                        <div className="text-xs text-gray-500">불러오는 중...</div>
                                    ) : enrolledClasses.length === 0 ? (
                                        <div className="text-xs text-gray-500">등록된 클래스가 없습니다.</div>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {enrolledClasses.map((c) => (
                                                <span
                                                    key={c.id}
                                                    className="text-xs px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/20"
                                                >
                                                    {c.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {detailLoading ? (
                                <div className="text-center text-xs text-gray-400 py-8">성적 정보를 불러오는 중...</div>
                            ) : (
                                <>
                                    {/* 성적 요약 4칸 */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-3.5">
                                            <div className="text-[11px] text-gray-400">총 응시</div>
                                            <div className="text-xl font-bold text-white mt-0.5">{totalExams}회</div>
                                        </div>
                                        <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-3.5">
                                            <div className="text-[11px] text-gray-400">누적 평균</div>
                                            <div className="text-xl font-bold text-blue-400 mt-0.5">{avgScore}점</div>
                                        </div>
                                        <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-3.5">
                                            <div className="text-[11px] text-gray-400">최고 점수</div>
                                            <div className="text-xl font-bold text-emerald-400 mt-0.5">{maxScore}점</div>
                                        </div>
                                        <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-3.5">
                                            <div className="text-[11px] text-gray-400">최근 점수</div>
                                            <div className="text-xl font-bold text-amber-400 mt-0.5">{latestScore}점</div>
                                        </div>
                                    </div>

                                    {/* 점수 추이 그래프 */}
                                    {totalExams > 0 && (
                                        <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-4">
                                            <div className="text-xs font-semibold text-white flex items-center gap-1.5 mb-4">
                                                <TrendingUp size={14} className="text-blue-400" /> 회차별 점수 추이
                                            </div>
                                            <div className="flex items-end gap-4 h-36 overflow-x-auto pt-2">
                                                {examResults.map((r, idx) => {
                                                    const score = Math.min(100, Math.max(0, Number(r.score || 0)));
                                                    return (
                                                        <div key={r.id} className="flex flex-col items-center min-w-[56px] h-full justify-end">
                                                            <span className="text-[11px] font-bold text-blue-300 mb-1">{score}점</span>
                                                            <div className="w-8 bg-gray-800 rounded-t-md h-24 flex items-end overflow-hidden">
                                                                <div
                                                                    className="w-full bg-blue-500 rounded-t-md"
                                                                    style={{ height: `${score}%` }}
                                                                />
                                                            </div>
                                                            <span
                                                                className="text-[10px] text-gray-400 mt-1.5 truncate max-w-[64px]"
                                                                title={r.exams?.title}
                                                            >
                                                                {r.exams?.title || `${idx + 1}회차`}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 시험별 상세 기록 */}
                                    <div className="bg-[#0f1117] border border-gray-800 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 border-b border-gray-800 text-xs font-semibold text-white flex items-center gap-1.5">
                                            <FileCheck2 size={14} className="text-blue-400" /> 시험별 성적 기록
                                        </div>
                                        {totalExams === 0 ? (
                                            <div className="p-6 text-center text-xs text-gray-500">
                                                아직 채점된 시험 기록이 없습니다.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-800/70">
                                                {[...examResults].reverse().map((r) => {
                                                    const wrongs = Array.isArray(r.wrong_numbers) ? r.wrong_numbers : [];
                                                    return (
                                                        <div
                                                            key={r.id}
                                                            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                                        >
                                                            <div>
                                                                <div className="text-sm font-medium text-white">
                                                                    {r.exams?.title || '시험명 없음'}
                                                                </div>
                                                                <div className="text-[11px] text-gray-400">
                                                                    {new Date(r.created_at).toLocaleDateString('ko-KR')}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-xs text-gray-400">
                                                                    오답:{' '}
                                                                    {wrongs.length > 0 ? (
                                                                        <span className="text-rose-400 font-medium">
                                                                            {wrongs.join(', ')}번
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-emerald-400 font-medium">만점</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-base font-bold text-blue-400 min-w-[48px] text-right">
                                                                    {r.score}점
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
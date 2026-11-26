'use client';

import React, { useMemo, useState } from 'react';
import { X, Printer, CheckSquare, Square, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

export interface WrongNoteItem {
  id: string;
  examTitle: string;
  examDate?: string;
  num: number;
  unit?: string;
  studentAnswer: string;
  correctAnswer: string;
  image_url?: string;
}

interface WrongNoteModalProps {
  studentName: string;
  items: WrongNoteItem[];
  initialSelectedId?: string | null; // 특정 문항 1개만 먼저 크게 볼 때 사용
  onClose: () => void;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function WrongNoteModal({
  studentName,
  items,
  initialSelectedId = null,
  onClose,
}: WrongNoteModalProps) {
  const [focusedId, setFocusedId] = useState<string | null>(initialSelectedId);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    items.forEach((it) => {
      init[it.id] = true;
    });
    return init;
  });
  const [examFilter, setExamFilter] = useState<string>('ALL');
  const [showAnswerInPrint, setShowAnswerInPrint] = useState<boolean>(false); // false = 재시험지 모드
  const [twoColumns, setTwoColumns] = useState<boolean>(true);

  const examTitles = useMemo(() => {
    return Array.from(new Set(items.map((it) => it.examTitle)));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (examFilter === 'ALL') return items;
    return items.filter((it) => it.examTitle === examFilter);
  }, [items, examFilter]);

  const focusedItem = useMemo(() => {
    if (!focusedId) return null;
    return items.find((it) => it.id === focusedId) || null;
  }, [items, focusedId]);

  const selectedForPrint = useMemo(() => {
    return filteredItems.filter((it) => checkedIds[it.id]);
  }, [filteredItems, checkedIds]);

  const toggleAll = () => {
    const allChecked = filteredItems.every((it) => checkedIds[it.id]);
    const next = { ...checkedIds };
    filteredItems.forEach((it) => {
      next[it.id] = !allChecked;
    });
    setCheckedIds(next);
  };

  const handlePrint = () => {
    if (selectedForPrint.length === 0) {
      alert('출력할 오답 문항을 1개 이상 선택해 주세요.');
      return;
    }

    const printWin = window.open('', '_blank', 'width=950,height=1100');
    if (!printWin) {
      alert('팝업 차단이 설정되어 있습니다. 브라우저 주소창 오른쪽에서 팝업을 허용해 주세요.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('ko-KR');

    const cardsHtml = selectedForPrint
      .map((item, idx) => {
        const meta = `${escapeHtml(item.examTitle)} · ${item.num}번${
          item.unit ? ` (${escapeHtml(item.unit)})` : ''
        }`;
        const ansHtml = showAnswerInPrint
          ? `<span class="ans-badge">내 답: ${escapeHtml(item.studentAnswer)} / 정답: <b>${escapeHtml(
              item.correctAnswer
            )}</b></span>`
          : `<span class="ans-blank">답: ____________</span>`;

        const imgHtml = item.image_url
          ? `<img src="${item.image_url}" alt="${meta}" />`
          : `<div class="no-img">등록된 문제 이미지가 없습니다. (원본 시험지 ${item.num}번 참고)</div>`;

        return `
          <div class="q-card">
            <div class="q-header">
              <span class="q-title"><strong>${idx + 1}.</strong> ${meta}</span>
              ${ansHtml}
            </div>
            <div class="q-body">${imgHtml}</div>
          </div>
        `;
      })
      .join('');

    const answerKeyHtml = !showAnswerInPrint
      ? `
        <div class="answer-key">
          <div class="answer-key-title">[정답표]</div>
          <div class="answer-key-grid">
            ${selectedForPrint
              .map(
                (item, idx) =>
                  `<span><b>${idx + 1})</b> ${escapeHtml(item.correctAnswer || '-')}</span>`
              )
              .join('')}
          </div>
        </div>
      `
      : '';

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(studentName)} 오답노트</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            color: #111;
            margin: 0;
            padding: 0;
          }
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2px solid #111;
            padding-bottom: 8px;
            margin-bottom: 14px;
          }
          .doc-title { font-size: 18px; font-weight: 800; }
          .doc-sub { font-size: 12px; color: #444; }
          .grid {
            display: grid;
            grid-template-columns: ${twoColumns ? '1fr 1fr' : '1fr'};
            gap: 14px;
          }
          .q-card {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 10px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .q-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
            margin-bottom: 8px;
            font-size: 11.5px;
          }
          .q-title { color: #1f2937; }
          .ans-badge { color: #b91c1c; font-size: 11px; }
          .ans-blank { color: #4b5563; font-size: 11px; }
          .q-body img {
            width: 100%;
            height: auto;
            display: block;
          }
          .no-img {
            padding: 24px 10px;
            text-align: center;
            font-size: 11.5px;
            color: #6b7280;
            background: #f9fafb;
            border-radius: 4px;
          }
          .answer-key {
            margin-top: 18px;
            padding-top: 10px;
            border-top: 1.5px dashed #9ca3af;
            break-inside: avoid;
          }
          .answer-key-title {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .answer-key-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px 18px;
            font-size: 11.5px;
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div class="doc-title">${escapeHtml(studentName)} 학생 맞춤형 오답노트</div>
          <div class="doc-sub">총 ${selectedForPrint.length}문항 · 출력일 ${todayStr}</div>
        </div>
        <div class="grid">${cardsHtml}</div>
        ${answerKeyHtml}
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#161922] border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-gray-800 bg-[#0f1117]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">
              {focusedItem
                ? `${focusedItem.examTitle} · ${focusedItem.num}번 오답 확인`
                : `${studentName} 오답 모아보기 & 출력 (${selectedForPrint.length}/${filteredItems.length}문항)`}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {focusedItem ? (
              <button
                type="button"
                onClick={() => setFocusedId(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200"
              >
                전체 오답 목록 · 출력하기
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowAnswerInPrint((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200"
                >
                  {showAnswerInPrint ? <Eye size={13} /> : <EyeOff size={13} />}
                  {showAnswerInPrint ? '인쇄 시 정답 표시' : '재시험지 모드(정답 숨김)'}
                </button>

                <button
                  type="button"
                  onClick={() => setTwoColumns((v) => !v)}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200"
                >
                  {twoColumns ? 'A4 2단' : 'A4 1단'}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  <Printer size={14} /> 오답노트 인쇄
                </button>
              </>
            )}

            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 본문: 단일 문항 크게 보기 vs 전체 오답 목록 */}
        {focusedItem ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f1117] border border-gray-800 rounded-xl px-4 py-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-gray-400">
                  내 답안:{' '}
                  <strong className="text-rose-400 text-sm">{focusedItem.studentAnswer}</strong>
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">
                  정답:{' '}
                  <strong className="text-emerald-400 text-sm">{focusedItem.correctAnswer}</strong>
                </span>
              </div>
              {focusedItem.unit && (
                <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                  {focusedItem.unit}
                </span>
              )}
            </div>

            {focusedItem.image_url ? (
              <div className="bg-white rounded-xl p-4 flex justify-center">
                <img
                  src={focusedItem.image_url}
                  alt={`${focusedItem.num}번 문제`}
                  className="max-w-full h-auto"
                />
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-gray-400 bg-[#0f1117] rounded-xl border border-gray-800">
                이 문항에는 캡처된 문제 이미지가 없습니다.
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {/* 시험 필터 & 전체 선택 바 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-800">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white"
              >
                {filteredItems.every((it) => checkedIds[it.id]) ? (
                  <CheckSquare size={15} className="text-blue-400" />
                ) : (
                  <Square size={15} className="text-gray-500" />
                )}
                전체 선택 / 해제
              </button>

              {examTitles.length > 1 && (
                <select
                  value={examFilter}
                  onChange={(e) => setExamFilter(e.target.value)}
                  className="bg-[#0f1117] border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-200"
                >
                  <option value="ALL">전체 시험 ({items.length}문항)</option>
                  {examTitles.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                오답 문항이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredItems.map((item) => {
                  const checked = !!checkedIds[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-xl p-3 transition ${
                        checked
                          ? 'border-blue-500/50 bg-[#0f1117]'
                          : 'border-gray-800 bg-[#0f1117]/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCheckedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                          }
                          className="flex items-center gap-2 text-left text-xs font-semibold text-white"
                        >
                          {checked ? (
                            <CheckSquare size={15} className="text-blue-400 shrink-0" />
                          ) : (
                            <Square size={15} className="text-gray-500 shrink-0" />
                          )}
                          <span>
                            {item.examTitle} · {item.num}번
                          </span>
                        </button>

                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-rose-400">내답 {item.studentAnswer}</span>
                          <span className="text-emerald-400">정답 {item.correctAnswer}</span>
                          {item.image_url && (
                            <button
                              type="button"
                              onClick={() => setFocusedId(item.id)}
                              className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-blue-300"
                            >
                              크게 보기
                            </button>
                          )}
                        </div>
                      </div>

                      {item.image_url ? (
                        <div
                          onClick={() => setFocusedId(item.id)}
                          className="bg-white rounded-lg p-2 max-h-44 overflow-hidden cursor-pointer"
                        >
                          <img
                            src={item.image_url}
                            alt={`${item.num}번`}
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-20 flex items-center justify-center gap-1.5 text-xs text-gray-500 bg-gray-900/50 rounded-lg">
                          <ImageIcon size={14} /> 이미지 없음
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
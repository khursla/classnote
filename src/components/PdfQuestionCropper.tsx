'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, Trash2, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface CroppedQuestionResult {
  num: number;
  image_url: string;
  answer: string;
}

interface CropBox {
  id: string;
  page: number; // 1-based
  num: number;
  x: number; // 0 ~ 1 정규화 좌표
  y: number;
  w: number;
  h: number;
}

interface PdfQuestionCropperProps {
  file: File;
  onClose: () => void;
  onComplete: (results: CroppedQuestionResult[]) => void;
}

const CIRCLE_MAP: Record<string, string> = {
  '①': '1',
  '②': '2',
  '③': '3',
  '④': '4',
  '⑤': '5',
};

function parseEndnoteAnswers(text: string): Record<number, string> {
  const answers: Record<number, string> = {};
  const normalized = text.replace(/[①②③④⑤]/g, (ch) => CIRCLE_MAP[ch] || ch);
  const regex = /(?:^|\s)(\d{1,2})\s*(?:\)|\.|번)\s*([^\n\r]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    const qNum = parseInt(match[1], 10);
    let rawAns = match[2].trim();
    rawAns = rawAns.split(/\s+\d{1,2}\s*(?:\)|\.|번)/)[0].trim();
    if (qNum > 0 && qNum <= 100 && rawAns) {
      answers[qNum] = rawAns.replace(/\s*,\s*/g, ',');
    }
  }
  return answers;
}

export default function PdfQuestionCropper({
  file,
  onClose,
  onComplete,
}: PdfQuestionCropperProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageImages, setPageImages] = useState<{ page: number; dataUrl: string; width: number; height: number }[]>([]);
  const [pageTexts, setPageTexts] = useState<Record<number, { str: string; x: number; y: number }[]>>({});
  const [rawTexts, setRawTexts] = useState<Record<number, string>>({});

  const [columns, setColumns] = useState<1 | 2>(2);
  const [answerPage, setAnswerPage] = useState<number>(0);
  const [boxes, setBoxes] = useState<CropBox[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [activePage, setActivePage] = useState<number>(1);

  const [dragState, setDragState] = useState<{
    mode: 'move' | 'resize-n' | 'resize-s' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'create';
    boxId?: string;
    startX: number;
    startY: number;
    origBox?: CropBox;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      setLoading(true);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        const imgs: { page: number; dataUrl: string; width: number; height: number }[] = [];
        const pTexts: Record<number, { str: string; x: number; y: number }[]> = {};
        const rTexts: Record<number, string> = {};

        for (let p = 1; p <= numPages; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;

          imgs.push({
            page: p,
            dataUrl: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height,
          });

          const textContent = await page.getTextContent();
          const items: { str: string; x: number; y: number }[] = [];
          const lines: string[] = [];

          for (const item of textContent.items as any[]) {
            if (!item.str || !item.str.trim()) continue;
            const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            const normX = vx / viewport.width;
            const normY = vy / viewport.height;
            items.push({ str: item.str.trim(), x: normX, y: normY });
            lines.push(item.str);
          }
          pTexts[p] = items;
          rTexts[p] = lines.join('\n');
        }

        if (cancelled) return;
        setPageImages(imgs);
        setPageTexts(pTexts);
        setRawTexts(rTexts);

        const defaultAnsPage = numPages > 1 ? numPages : 0;
        setAnswerPage(defaultAnsPage);
        if (defaultAnsPage > 0) {
          setAnswers(parseEndnoteAnswers(rTexts[defaultAnsPage] || ''));
        }
        autoDetectBoxes(imgs, pTexts, 2, defaultAnsPage);
      } catch (err) {
        console.error('PDF 로드 실패:', err);
        alert('PDF를 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [file]);

  function autoDetectBoxes(
    imgs: { page: number }[],
    pTexts: Record<number, { str: string; x: number; y: number }[]>,
    colCount: 1 | 2,
    ansPage: number
  ) {
    const detected: CropBox[] = [];

    for (const img of imgs) {
      if (img.page === ansPage) continue;
      const items = pTexts[img.page] || [];

      const markers: { num: number; col: number; y: number }[] = [];
      for (const it of items) {
        const m = it.str.match(/^(\d{1,2})\./);
        if (!m) continue;
        const num = parseInt(m[1], 10);
        if (num < 1 || num > 100) continue;
        if (it.y < 0.06 || it.y > 0.96) continue;

        const col = colCount === 2 ? (it.x < 0.48 ? 0 : 1) : 0;
        if (colCount === 2) {
          if (col === 0 && it.x > 0.16) continue;
          if (col === 1 && (it.x < 0.48 || it.x > 0.65)) continue;
        } else {
          if (it.x > 0.2) continue;
        }

        if (!markers.some((mk) => mk.num === num && mk.col === col)) {
          markers.push({ num, col, y: it.y });
        }
      }

      for (let c = 0; c < colCount; c++) {
        const colMarkers = markers
          .filter((mk) => mk.col === c)
          .sort((a, b) => a.y - b.y);

        const xStart = colCount === 2 ? (c === 0 ? 0.03 : 0.51) : 0.04;
        const boxW = colCount === 2 ? 0.46 : 0.92;

        for (let i = 0; i < colMarkers.length; i++) {
          const cur = colMarkers[i];
          const next = colMarkers[i + 1];
          const yTop = Math.max(0.05, cur.y - 0.018);
          const yBottom = next ? Math.max(yTop + 0.08, next.y - 0.025) : 0.95;

          detected.push({
            id: `${img.page}-${cur.num}-${Math.random().toString(36).slice(2, 6)}`,
            page: img.page,
            num: cur.num,
            x: xStart,
            y: yTop,
            w: boxW,
            h: Math.min(0.98 - yTop, yBottom - yTop),
          });
        }
      }
    }

    detected.sort((a, b) => a.num - b.num);
    setBoxes(detected);
  }

  const handleAnswerPageChange = (newAnsPage: number) => {
    setAnswerPage(newAnsPage);
    if (newAnsPage > 0) {
      setAnswers(parseEndnoteAnswers(rawTexts[newAnsPage] || ''));
    } else {
      setAnswers({});
    }
    autoDetectBoxes(pageImages, pageTexts, columns, newAnsPage);
  };

  const getNormCoords = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      nx: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      ny: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.boxControl) return;
    const { nx, ny } = getNormCoords(e);
    const nextNum = boxes.length > 0 ? Math.max(...boxes.map((b) => b.num)) + 1 : 1;
    const newBox: CropBox = {
      id: `manual-${Date.now()}`,
      page: activePage,
      num: nextNum,
      x: nx,
      y: ny,
      w: 0.01,
      h: 0.01,
    };
    setBoxes((prev) => [...prev, newBox]);
    setDragState({ mode: 'create', boxId: newBox.id, startX: nx, startY: ny, origBox: newBox });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !containerRef.current) return;
    const { nx, ny } = getNormCoords(e);
    const dx = nx - dragState.startX;
    const dy = ny - dragState.startY;

    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== dragState.boxId || !dragState.origBox) return b;
        const o = dragState.origBox;
        if (dragState.mode === 'move') {
          return {
            ...b,
            x: Math.max(0, Math.min(1 - o.w, o.x + dx)),
            y: Math.max(0, Math.min(1 - o.h, o.y + dy)),
          };
        }
        if (dragState.mode === 'create') {
          const x = Math.min(dragState.startX, nx);
          const y = Math.min(dragState.startY, ny);
          return { ...b, x, y, w: Math.max(0.02, Math.abs(dx)), h: Math.max(0.02, Math.abs(dy)) };
        }
        if (dragState.mode === 'resize-s') {
          return { ...b, h: Math.max(0.03, Math.min(1 - o.y, o.h + dy)) };
        }
        if (dragState.mode === 'resize-n') {
          const newY = Math.max(0, Math.min(o.y + o.h - 0.03, o.y + dy));
          return { ...b, y: newY, h: o.h + (o.y - newY) };
        }
        if (dragState.mode === 'resize-se') {
          return { ...b, w: Math.max(0.05, Math.min(1 - o.x, o.w + dx)), h: Math.max(0.03, Math.min(1 - o.y, o.h + dy)) };
        }
        if (dragState.mode === 'resize-nw') {
          const newX = Math.max(0, Math.min(o.x + o.w - 0.05, o.x + dx));
          const newY = Math.max(0, Math.min(o.y + o.h - 0.03, o.y + dy));
          return { ...b, x: newX, y: newY, w: o.w + (o.x - newX), h: o.h + (o.y - newY) };
        }
        if (dragState.mode === 'resize-ne') {
          const newY = Math.max(0, Math.min(o.y + o.h - 0.03, o.y + dy));
          return { ...b, y: newY, w: Math.max(0.05, Math.min(1 - o.x, o.w + dx)), h: o.h + (o.y - newY) };
        }
        if (dragState.mode === 'resize-sw') {
          const newX = Math.max(0, Math.min(o.x + o.w - 0.05, o.x + dx));
          return { ...b, x: newX, w: o.w + (o.x - newX), h: Math.max(0.03, Math.min(1 - o.y, o.h + dy)) };
        }
        return b;
      })
    );
  };

  const handleMouseUp = () => {
    if (dragState?.mode === 'create') {
      setBoxes((prev) => prev.filter((b) => b.id !== dragState.boxId || (b.w > 0.04 && b.h > 0.02)));
    }
    setDragState(null);
  };

  const handleConfirmUpload = async () => {
    if (boxes.length === 0) {
      alert('캡처할 문항 박스가 없습니다.');
      return;
    }
    setSaving(true);
    try {
      const sorted = [...boxes].sort((a, b) => a.num - b.num);
      const results: CroppedQuestionResult[] = [];
      const batchId = Date.now();

      for (const box of sorted) {
        const pageImg = pageImages.find((p) => p.page === box.page);
        if (!pageImg) continue;

        const img = new Image();
        img.src = pageImg.dataUrl;
        await new Promise((res) => (img.onload = res));

        const sx = Math.floor(box.x * img.width);
        const sy = Math.floor(box.y * img.height);
        const sw = Math.floor(box.w * img.width);
        const sh = Math.floor(box.h * img.height);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sw;
        cropCanvas.height = sh;
        const ctx = cropCanvas.getContext('2d')!;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        const blob: Blob = await new Promise((resolve) =>
          cropCanvas.toBlob((b) => resolve(b!), 'image/png')
        );

        const filePath = `crops/${batchId}_q${box.num}.png`;
        const { error } = await supabase.storage
          .from('exam-questions')
          .upload(filePath, blob, { contentType: 'image/png', upsert: true });

        if (error) throw error;

        const { data: pubData } = supabase.storage
          .from('exam-questions')
          .getPublicUrl(filePath);

        results.push({
          num: box.num,
          image_url: pubData.publicUrl,
          answer: answers[box.num] || '',
        });
      }

      onComplete(results);
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      alert('문항 이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const currentPageImg = pageImages.find((p) => p.page === activePage);
  const currentBoxes = boxes.filter((b) => b.page === activePage);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#161922] border border-gray-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* 상단 툴바 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-800 bg-[#0f1117]">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white">PDF 문항 자동 캡처 & 영역 조절</h3>
            <span className="text-xs text-gray-400">
              총 {boxes.length}문항 감지 · 빈 곳을 드래그해 박스 추가 가능
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={columns}
              onChange={(e) => {
                const c = Number(e.target.value) as 1 | 2;
                setColumns(c);
                autoDetectBoxes(pageImages, pageTexts, c, answerPage);
              }}
              className="bg-[#161922] border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-200"
            >
              <option value={2}>2단 시험지</option>
              <option value={1}>1단 시험지</option>
            </select>

            <select
              value={answerPage}
              onChange={(e) => handleAnswerPageChange(Number(e.target.value))}
              className="bg-[#161922] border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-200"
            >
              <option value={0}>정답(미주) 페이지 없음</option>
              {pageImages.map((p) => (
                <option key={p.page} value={p.page}>
                  정답(미주): {p.page}페이지
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => autoDetectBoxes(pageImages, pageTexts, columns, answerPage)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg"
            >
              <RefreshCw size={13} /> 자동 재인식
            </button>

            <button
              type="button"
              disabled={saving || loading}
              onClick={handleConfirmUpload}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? '업로드 중...' : '크롭 완료 및 적용'}
            </button>

            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 본문: 좌측 페이지 목록 + 중앙 에디터 + 우측 정답 미리보기 */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-sm">PDF 페이지를 분석하고 문항 영역을 찾는 중...</p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* 좌측 페이지 탭 */}
            <div className="w-28 border-r border-gray-800 p-2 overflow-y-auto space-y-2 bg-[#0f1117]">
              {pageImages.map((p) => {
                const count = boxes.filter((b) => b.page === p.page).length;
                const isAns = p.page === answerPage;
                return (
                  <button
                    key={p.page}
                    type="button"
                    onClick={() => setActivePage(p.page)}
                    className={`w-full p-2 rounded-lg text-left text-xs border transition ${
                      activePage === p.page
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-800 bg-[#161922] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold">{p.page}쪽</div>
                    <div className="text-[11px] text-gray-400">
                      {isAns ? '정답(미주)' : `${count}문항`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 중앙 PDF + 드래그 박스 */}
            <div
              className="flex-1 overflow-y-auto p-6 bg-[#0a0c10] select-none"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {currentPageImg && (
                <div
                  ref={containerRef}
                  onMouseDown={handleMouseDownCanvas}
                  className="relative mx-auto shadow-2xl cursor-crosshair"
                  style={{ maxWidth: '720px', width: '100%' }}
                >
                  <img
                    src={currentPageImg.dataUrl}
                    alt={`page-${activePage}`}
                    draggable={false}
                    className="w-full h-auto block rounded"
                  />

                  {currentBoxes.map((box) => (
                    <div
                      key={box.id}
                      data-box-control="true"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const { nx, ny } = getNormCoords(e);
                        setDragState({ mode: 'move', boxId: box.id, startX: nx, startY: ny, origBox: box });
                      }}
                      style={{
                        left: `${box.x * 100}%`,
                        top: `${box.y * 100}%`,
                        width: `${box.w * 100}%`,
                        height: `${box.h * 100}%`,
                      }}
                      className="absolute border-2 border-blue-500 bg-blue-500/10 hover:bg-blue-500/15 cursor-move group"
                    >
                      {/* 문항 번호 & 삭제 버튼 */}
                      <div
                        data-box-control="true"
                        className="absolute -top-6 left-0 flex items-center gap-1 bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-t"
                      >
                        <input
                          type="number"
                          value={box.num}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setBoxes((prev) => prev.map((b) => (b.id === box.id ? { ...b, num: val } : b)));
                          }}
                          className="w-8 bg-transparent text-white text-center outline-none"
                        />
                        <span>번</span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => setBoxes((prev) => prev.filter((b) => b.id !== box.id))}
                          className="ml-1 hover:text-red-200"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>

                      {/* 윗변·아랫변 조절 핸들 */}
                      <div
                        data-box-control="true"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const { nx, ny } = getNormCoords(e);
                          setDragState({ mode: 'resize-n', boxId: box.id, startX: nx, startY: ny, origBox: box });
                        }}
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-ns-resize"
                      />
                      <div
                        data-box-control="true"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const { nx, ny } = getNormCoords(e);
                          setDragState({ mode: 'resize-s', boxId: box.id, startX: nx, startY: ny, origBox: box });
                        }}
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-ns-resize"
                      />

                      {/* 4개 모서리 리사이즈 핸들 */}
                      {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                        <div
                          key={corner}
                          data-box-control="true"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const { nx, ny } = getNormCoords(e);
                            setDragState({
                              mode: `resize-${corner}`,
                              boxId: box.id,
                              startX: nx,
                              startY: ny,
                              origBox: box,
                            });
                          }}
                          className={`absolute w-3 h-3 bg-white border-2 border-blue-600 rounded-sm ${
                            corner === 'nw' ? '-top-1.5 -left-1.5 cursor-nwse-resize' :
                            corner === 'ne' ? '-top-1.5 -right-1.5 cursor-nesw-resize' :
                            corner === 'sw' ? '-bottom-1.5 -left-1.5 cursor-nesw-resize' :
                            '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 우측 미주 정답 확인/수정 */}
            <div className="w-60 border-l border-gray-800 p-3 overflow-y-auto bg-[#0f1117]">
              <div className="text-xs font-semibold text-gray-300 mb-2">
                추출된 정답 ({Object.keys(answers).length}개)
              </div>
              <div className="space-y-1.5">
                {[...boxes]
                  .sort((a, b) => a.num - b.num)
                  .map((b) => (
                    <div key={b.id} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-gray-400 font-medium">{b.num}번</span>
                      <input
                        type="text"
                        value={answers[b.num] || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [b.num]: e.target.value }))}
                        placeholder="정답 입력"
                        className="flex-1 bg-[#161922] border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
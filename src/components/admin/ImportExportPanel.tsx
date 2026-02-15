import { useRef, useState } from 'react';
import { useIdolStore } from '@/stores/idol-store';
import {
  exportIdol,
  exportAllIdols,
  importIdol,
  downloadJson,
  validateBundle,
} from '@/lib/idol-export';
import type { IdolBundle } from '@/types/idol';
import { useAdminStore } from '@/stores/admin-store';

export default function ImportExportPanel() {
  const idols = useIdolStore((s) => s.idols);
  const loadIdols = useIdolStore((s) => s.loadIdols);
  const selectedIdolId = useAdminStore((s) => s.selectedIdolId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const selectedIdol = idols.find((i) => i.id === selectedIdolId);

  const handleExportCurrent = async () => {
    if (!selectedIdol) return;
    const bundle = await exportIdol(selectedIdol.id, selectedIdol);
    downloadJson(bundle, `${selectedIdol.id}-export.json`);
  };

  const handleExportAll = async () => {
    const bundles = await exportAllIdols(idols);
    downloadJson(bundles, 'mimchat-all-export.json');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Check if it's a single bundle or array
      const bundles: IdolBundle[] = Array.isArray(data) ? data : [data];

      let successCount = 0;
      for (const bundle of bundles) {
        if (!validateBundle(bundle)) {
          setMessage('올바르지 않은 형식의 파일입니다.');
          continue;
        }
        const result = await importIdol(bundle, true);
        if (result.success) successCount++;
      }

      await loadIdols();
      setMessage(`${successCount}개 아이돌 가져오기 완료!`);
    } catch {
      setMessage('파일 읽기에 실패했습니다.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="text-xs text-green-600 animate-fade-in">
          {message}
        </span>
      )}

      {selectedIdol && (
        <button
          onClick={handleExportCurrent}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          title="선택한 아이돌 내보내기"
        >
          내보내기
        </button>
      )}

      <button
        onClick={handleExportAll}
        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        title="전체 내보내기"
      >
        전체 내보내기
      </button>

      <label className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
        {importing ? '가져오는 중...' : '가져오기'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
          disabled={importing}
        />
      </label>
    </div>
  );
}

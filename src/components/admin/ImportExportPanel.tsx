import { useRef, useState } from 'react';
import { usePoliticianStore } from '@/stores/politician-store';
import {
  exportPolitician,
  exportAllPoliticians,
  importPolitician,
  downloadJson,
  validateBundle,
} from '@/lib/politician-export';
import type { PoliticianBundle } from '@/types/politician';
import { useAdminStore } from '@/stores/admin-store';

export default function ImportExportPanel() {
  const politicians = usePoliticianStore((s) => s.politicians);
  const loadPoliticians = usePoliticianStore((s) => s.loadPoliticians);
  const selectedPoliticianId = useAdminStore((s) => s.selectedPoliticianId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const selectedPolitician = politicians.find((i) => i.id === selectedPoliticianId);

  const handleExportCurrent = async () => {
    if (!selectedPolitician) return;
    const bundle = await exportPolitician(selectedPolitician.id, selectedPolitician);
    downloadJson(bundle, `${selectedPolitician.id}-export.json`);
  };

  const handleExportAll = async () => {
    const bundles = await exportAllPoliticians(politicians);
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
      const bundles: PoliticianBundle[] = Array.isArray(data) ? data : [data];

      let successCount = 0;
      for (const bundle of bundles) {
        if (!validateBundle(bundle)) {
          setMessage('올바르지 않은 형식의 파일입니다.');
          continue;
        }
        const result = await importPolitician(bundle, true);
        if (result.success) successCount++;
      }

      await loadPoliticians();
      setMessage(`${successCount}개 정치인 가져오기 완료!`);
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

      {selectedPolitician && (
        <button
          onClick={handleExportCurrent}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          title="선택한 정치인 내보내기"
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

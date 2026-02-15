import { useEffect } from 'react';
import { Link } from 'react-router';
import { useIdolStore } from '@/stores/idol-store';
import { useAdminStore } from '@/stores/admin-store';
import IdolListPanel from './IdolListPanel';
import IdolEditForm from './IdolEditForm';
import KnowledgeEditor from './KnowledgeEditor';
import TestChatPanel from './TestChatPanel';
import ImportExportPanel from './ImportExportPanel';

export default function AdminLayout() {
  const idols = useIdolStore((s) => s.idols);
  const selectedIdolId = useAdminStore((s) => s.selectedIdolId);
  const setSelectedIdol = useAdminStore((s) => s.setSelectedIdol);
  const isTestChatOpen = useAdminStore((s) => s.isTestChatOpen);

  const selectedIdol = idols.find((i) => i.id === selectedIdolId) ?? null;

  // Auto-select first idol
  useEffect(() => {
    if (!selectedIdolId && idols.length > 0) {
      setSelectedIdol(idols[0]!.id);
    }
  }, [idols, selectedIdolId, setSelectedIdol]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-800">
            Polichat Admin
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ImportExportPanel />
          <Link
            to="/"
            className="text-sm text-purple-600 hover:text-purple-800 transition-colors"
          >
            채팅으로 돌아가기 &rarr;
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <IdolListPanel />

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {selectedIdol ? (
            <div className="p-6 max-w-4xl">
              <IdolEditForm idol={selectedIdol} />
              <div className="mt-6">
                <KnowledgeEditor idol={selectedIdol} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              왼쪽에서 아이돌을 선택하세요
            </div>
          )}
        </div>

        {/* Test chat drawer */}
        {isTestChatOpen && selectedIdol && (
          <TestChatPanel idol={selectedIdol} />
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { Link } from 'react-router';
import { usePoliticianStore } from '@/stores/politician-store';
import { useAdminStore } from '@/stores/admin-store';
import PoliticianListPanel from './PoliticianListPanel';
import PoliticianEditForm from './PoliticianEditForm';
import KnowledgeEditor from './KnowledgeEditor';
import TestChatPanel from './TestChatPanel';
import ImportExportPanel from './ImportExportPanel';

export default function AdminLayout() {
  const politicians = usePoliticianStore((s) => s.politicians);
  const selectedPoliticianId = useAdminStore((s) => s.selectedPoliticianId);
  const setSelectedPolitician = useAdminStore((s) => s.setSelectedPolitician);
  const isTestChatOpen = useAdminStore((s) => s.isTestChatOpen);

  const selectedPolitician = politicians.find((i) => i.id === selectedPoliticianId) ?? null;

  // Auto-select first politician
  useEffect(() => {
    if (!selectedPoliticianId && politicians.length > 0) {
      setSelectedPolitician(politicians[0]!.id);
    }
  }, [politicians, selectedPoliticianId, setSelectedPolitician]);

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
        <PoliticianListPanel />

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {selectedPolitician ? (
            <div className="p-6 max-w-4xl">
              <PoliticianEditForm politician={selectedPolitician} />
              <div className="mt-6">
                <KnowledgeEditor politician={selectedPolitician} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              왼쪽에서 정치인을 선택하세요
            </div>
          )}
        </div>

        {/* Test chat drawer */}
        {isTestChatOpen && selectedPolitician && (
          <TestChatPanel politician={selectedPolitician} />
        )}
      </div>
    </div>
  );
}

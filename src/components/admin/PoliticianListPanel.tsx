import { useState } from 'react';
import { usePoliticianStore } from '@/stores/politician-store';
import { useAdminStore } from '@/stores/admin-store';
import type { PoliticianMeta } from '@/types/politician';

export default function PoliticianListPanel() {
  const politicians = usePoliticianStore((s) => s.politicians);
  const addPolitician = usePoliticianStore((s) => s.addPolitician);
  const deletePolitician = usePoliticianStore((s) => s.deletePolitician);
  const resetBuiltInPolitician = usePoliticianStore((s) => s.resetBuiltInPolitician);
  const selectedPoliticianId = useAdminStore((s) => s.selectedPoliticianId);
  const setSelectedPolitician = useAdminStore((s) => s.setSelectedPolitician);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPoliticianId, setNewIdolId] = useState('');
  const [newPoliticianName, setNewIdolName] = useState('');
  const [newPoliticianGroup, setNewIdolGroup] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newPoliticianId.trim() || !newPoliticianName.trim()) return;
    const id = newPoliticianId.trim().toLowerCase().replace(/\s+/g, '-');
    await addPolitician({
      id,
      nameKo: newPoliticianName.trim(),
      nameEn: '',
      group: newPoliticianGroup.trim(),
      profileImageUrl: '',
      themeColor: '#6366F1',
      themeColorSecondary: '#A5B4FC',
      tagline: '',
    });
    setSelectedPolitician(id);
    setShowAddForm(false);
    setNewIdolId('');
    setNewIdolName('');
    setNewIdolGroup('');
  };

  const handleDelete = async (politician: PoliticianMeta) => {
    if (politician.isBuiltIn) {
      await resetBuiltInPolitician(politician.id);
    } else {
      await deletePolitician(politician.id);
    }
    setDeleteConfirm(null);
    if (selectedPoliticianId === politician.id) {
      setSelectedPolitician(null);
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-gray-100">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          + 정치인 추가
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-3 border-b border-gray-100 space-y-2 bg-gray-50">
          <input
            type="text"
            value={newPoliticianId}
            onChange={(e) => setNewIdolId(e.target.value)}
            placeholder="ID (영문, 예: irene)"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
          />
          <input
            type="text"
            value={newPoliticianName}
            onChange={(e) => setNewIdolName(e.target.value)}
            placeholder="이름 (예: 아이린)"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
          />
          <input
            type="text"
            value={newPoliticianGroup}
            onChange={(e) => setNewIdolGroup(e.target.value)}
            placeholder="그룹 (예: Red Velvet)"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newPoliticianId.trim() || !newPoliticianName.trim()}
              className="flex-1 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium disabled:opacity-40"
            >
              추가
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-medium"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Politician list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {politicians.map((politician) => (
          <div
            key={politician.id}
            className={`flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${
              selectedPoliticianId === politician.id ? 'bg-purple-50' : ''
            }`}
            onClick={() => setSelectedPolitician(politician.id)}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{
                background: `linear-gradient(135deg, ${politician.themeColor}, ${politician.themeColorSecondary})`,
              }}
            >
              {politician.profileImageUrl ? (
                <img
                  src={politician.profileImageUrl}
                  alt={politician.nameKo}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                politician.nameKo.slice(0, 1)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {politician.nameKo}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {politician.group}
                {politician.isBuiltIn && (
                  <span className="ml-1 text-purple-400">(기본 제공)</span>
                )}
              </div>
            </div>
            {/* Delete / Reset button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (deleteConfirm === politician.id) {
                  handleDelete(politician);
                } else {
                  setDeleteConfirm(politician.id);
                  setTimeout(() => setDeleteConfirm(null), 3000);
                }
              }}
              className={`text-xs px-2 py-1 rounded shrink-0 transition-colors ${
                deleteConfirm === politician.id
                  ? 'bg-red-500 text-white'
                  : 'text-gray-300 hover:text-red-400'
              }`}
              title={politician.isBuiltIn ? '초기화' : '삭제'}
            >
              {deleteConfirm === politician.id
                ? '확인?'
                : politician.isBuiltIn
                  ? '초기화'
                  : '삭제'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useIdolStore } from '@/stores/idol-store';
import { useAdminStore } from '@/stores/admin-store';
import type { IdolMeta } from '@/types/idol';

export default function IdolListPanel() {
  const idols = useIdolStore((s) => s.idols);
  const addIdol = useIdolStore((s) => s.addIdol);
  const deleteIdol = useIdolStore((s) => s.deleteIdol);
  const resetBuiltInIdol = useIdolStore((s) => s.resetBuiltInIdol);
  const selectedIdolId = useAdminStore((s) => s.selectedIdolId);
  const setSelectedIdol = useAdminStore((s) => s.setSelectedIdol);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIdolId, setNewIdolId] = useState('');
  const [newIdolName, setNewIdolName] = useState('');
  const [newIdolGroup, setNewIdolGroup] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newIdolId.trim() || !newIdolName.trim()) return;
    const id = newIdolId.trim().toLowerCase().replace(/\s+/g, '-');
    await addIdol({
      id,
      nameKo: newIdolName.trim(),
      nameEn: '',
      group: newIdolGroup.trim(),
      profileImageUrl: '',
      themeColor: '#6366F1',
      themeColorSecondary: '#A5B4FC',
      tagline: '',
    });
    setSelectedIdol(id);
    setShowAddForm(false);
    setNewIdolId('');
    setNewIdolName('');
    setNewIdolGroup('');
  };

  const handleDelete = async (idol: IdolMeta) => {
    if (idol.isBuiltIn) {
      await resetBuiltInIdol(idol.id);
    } else {
      await deleteIdol(idol.id);
    }
    setDeleteConfirm(null);
    if (selectedIdolId === idol.id) {
      setSelectedIdol(null);
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
          + 아이돌 추가
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-3 border-b border-gray-100 space-y-2 bg-gray-50">
          <input
            type="text"
            value={newIdolId}
            onChange={(e) => setNewIdolId(e.target.value)}
            placeholder="ID (영문, 예: irene)"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
          />
          <input
            type="text"
            value={newIdolName}
            onChange={(e) => setNewIdolName(e.target.value)}
            placeholder="이름 (예: 아이린)"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
          />
          <input
            type="text"
            value={newIdolGroup}
            onChange={(e) => setNewIdolGroup(e.target.value)}
            placeholder="그룹 (예: Red Velvet)"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newIdolId.trim() || !newIdolName.trim()}
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

      {/* Idol list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {idols.map((idol) => (
          <div
            key={idol.id}
            className={`flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${
              selectedIdolId === idol.id ? 'bg-purple-50' : ''
            }`}
            onClick={() => setSelectedIdol(idol.id)}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{
                background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
              }}
            >
              {idol.profileImageUrl ? (
                <img
                  src={idol.profileImageUrl}
                  alt={idol.nameKo}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                idol.nameKo.slice(0, 1)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {idol.nameKo}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {idol.group}
                {idol.isBuiltIn && (
                  <span className="ml-1 text-purple-400">(빌트인)</span>
                )}
              </div>
            </div>
            {/* Delete / Reset button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (deleteConfirm === idol.id) {
                  handleDelete(idol);
                } else {
                  setDeleteConfirm(idol.id);
                  setTimeout(() => setDeleteConfirm(null), 3000);
                }
              }}
              className={`text-xs px-2 py-1 rounded shrink-0 transition-colors ${
                deleteConfirm === idol.id
                  ? 'bg-red-500 text-white'
                  : 'text-gray-300 hover:text-red-400'
              }`}
              title={idol.isBuiltIn ? '초기화' : '삭제'}
            >
              {deleteConfirm === idol.id
                ? '확인?'
                : idol.isBuiltIn
                  ? '초기화'
                  : '삭제'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

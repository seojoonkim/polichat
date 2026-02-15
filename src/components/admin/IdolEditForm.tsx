import { useState, useEffect, useRef, useCallback } from 'react';
import type { IdolMeta } from '@/types/idol';
import { useIdolStore } from '@/stores/idol-store';
import { useAdminStore } from '@/stores/admin-store';
import ImageCropEditor from './ImageCropEditor';

interface Props {
  idol: IdolMeta;
}

export default function IdolEditForm({ idol }: Props) {
  const updateIdolMeta = useIdolStore((s) => s.updateIdolMeta);
  const toggleTestChat = useAdminStore((s) => s.toggleTestChat);
  const [form, setForm] = useState({
    nameKo: '',
    nameEn: '',
    group: '',
    profileImageUrl: '',
    themeColor: '',
    themeColorSecondary: '',
    tagline: '',
  });
  const [saved, setSaved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      nameKo: idol.nameKo,
      nameEn: idol.nameEn,
      group: idol.group,
      profileImageUrl: idol.profileImageUrl,
      themeColor: idol.themeColor,
      themeColorSecondary: idol.themeColorSecondary,
      tagline: idol.tagline,
    });
    setSaved(false);
  }, [idol.id]);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    // Store file and open crop editor
    setPendingFile(file);
    setShowCropEditor(true);
  }, []);

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsUploading(true);
    try {
      // Convert blob to base64
      const arrayBuffer = await croppedBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idolId: idol.id,
          imageData: base64,
          contentType: croppedBlob.type || 'image/jpeg',
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { url } = await response.json();
      setForm((f) => ({ ...f, profileImageUrl: url }));
      setShowCropEditor(false);
      setPendingFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleSave = async () => {
    await updateIdolMeta(idol.id, form);
    
    // Upload to server (background)
    try {
      await fetch('/api/upload-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          idolId: idol.id, 
          meta: { ...idol, ...form, updatedAt: Date.now() }
        }),
      });
    } catch (error) {
      console.error('Server upload error:', error);
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (
    label: string,
    key: keyof typeof form,
    type = 'text',
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-100"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">
          아이돌 정보
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({idol.id})
          </span>
        </h2>
        <button
          onClick={toggleTestChat}
          className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-medium hover:bg-purple-200 transition-colors"
        >
          테스트 채팅
        </button>
      </div>

      {/* Profile Image Drop Zone */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-2">
          프로필 이미지
        </label>
        <div className="flex items-start gap-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center
              cursor-pointer transition-all overflow-hidden shrink-0
              ${isDragging
                ? 'border-purple-400 bg-purple-50 scale-105'
                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
              }
            `}
          >
            {form.profileImageUrl ? (
              <img
                src={form.profileImageUrl}
                alt="프로필"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-2">
                <svg
                  className="w-6 h-6 mx-auto text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  드래그 또는 클릭
                </span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={form.profileImageUrl}
              onChange={(e) =>
                setForm({ ...form, profileImageUrl: e.target.value })
              }
              placeholder="이미지 URL 또는 파일을 드래그하세요"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-100 text-gray-600"
            />
            {form.profileImageUrl && (
              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => setShowCropEditor(true)}
                  className="text-xs text-purple-500 hover:text-purple-700 transition-colors"
                >
                  새 이미지 업로드
                </button>
                <button
                  onClick={() => setForm({ ...form, profileImageUrl: '' })}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  이미지 제거
                </button>
              </div>
            )}
            {!form.profileImageUrl && (
              <button
                onClick={() => setShowCropEditor(true)}
                className="text-xs text-purple-500 hover:text-purple-700 mt-1 transition-colors"
              >
                이미지 업로드
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field('이름 (한국어)', 'nameKo')}
        {field('이름 (영어)', 'nameEn')}
        {field('그룹', 'group')}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            메인 테마 색상
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.themeColor}
              onChange={(e) =>
                setForm({ ...form, themeColor: e.target.value })
              }
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={form.themeColor}
              onChange={(e) =>
                setForm({ ...form, themeColor: e.target.value })
              }
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            서브 테마 색상
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.themeColorSecondary}
              onChange={(e) =>
                setForm({ ...form, themeColorSecondary: e.target.value })
              }
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={form.themeColorSecondary}
              onChange={(e) =>
                setForm({ ...form, themeColorSecondary: e.target.value })
              }
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-300"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">{field('태그라인', 'tagline')}</div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-5 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          저장
        </button>
        {saved && (
          <span className="text-sm text-green-600 animate-fade-in">
            저장되었습니다!
          </span>
        )}
      </div>

      {/* Image Crop Editor Modal */}
      {showCropEditor && (
        <ImageCropEditor
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropEditor(false);
            setPendingFile(null);
          }}
          initialFile={pendingFile || undefined}
        />
      )}

      {/* Upload overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>업로드 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}

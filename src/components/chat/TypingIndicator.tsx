import type { PoliticianMeta } from '@/types/politician';

interface Props {
  politician: PoliticianMeta;
}

export default function TypingIndicator({ politician }: Props) {
  return (
    <div className="flex gap-2.5 mb-3 animate-fade-in">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm overflow-hidden ring-1 ring-black/5"
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
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] text-gray-400 ml-1 font-medium">
          {politician.nameKo} is typing...
        </span>
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-md inline-flex items-center gap-1.5 shadow-sm"
          style={{
            backgroundColor: `${politician.themeColor}10`,
            border: `1px solid ${politician.themeColor}25`,
          }}
        >
          <div
            className="w-2 h-2 rounded-full typing-dot"
            style={{ backgroundColor: politician.themeColor }}
          />
          <div
            className="w-2 h-2 rounded-full typing-dot"
            style={{ backgroundColor: politician.themeColor }}
          />
          <div
            className="w-2 h-2 rounded-full typing-dot"
            style={{ backgroundColor: politician.themeColor }}
          />
        </div>
      </div>
    </div>
  );
}

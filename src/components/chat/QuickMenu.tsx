import { useState } from 'react';

interface QuickMenuItem {
  label: string;
  message: string | null; // null = direct ask (focus input)
  icon?: string;
}

function getMenuItems(politicianId: string): QuickMenuItem[] {
  // 대통령
  if (politicianId === 'leejm') {
    return [
      { label: '핵심 국정과제가 궁금합니다', message: '대통령님의 핵심 국정과제가 궁금합니다', icon: 'building' },
      { label: '요즘 가장 중요한 이슈가 뭔가요?', message: '요즘 가장 중요하게 생각하시는 이슈가 뭔가요?', icon: 'comment' },
      { label: '자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?', icon: 'hand' },
      { label: '직접 질문할게요', message: null, icon: 'pen' },
    ];
  }

  // 당대표
  if (politicianId === 'jungcr' || politicianId === 'jangdh') {
    return [
      { label: '당의 방향성이 궁금합니다', message: '앞으로 당을 어떤 방향으로 이끌어가실 건가요?', icon: 'building' },
      { label: '요즘 뜨는 이슈에 대해 어떻게 생각하세요?', message: '요즘 가장 뜨거운 이슈에 대해 어떻게 생각하세요?', icon: 'comment' },
      { label: '자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?', icon: 'hand' },
      { label: '직접 질문할게요', message: null, icon: 'pen' },
    ];
  }

  // 시장/구청장
  if (politicianId === 'ohsehoon' || politicianId === 'jungwono') {
    return [
      { label: '지역 정책이 궁금합니다', message: '요즘 가장 중점적으로 추진하시는 정책이 뭔가요?', icon: 'building' },
      { label: '우리 동네에 대해 물어볼게요', message: '우리 지역에서 요즘 가장 중요한 변화가 뭔가요?', icon: 'comment' },
      { label: '자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?', icon: 'hand' },
      { label: '직접 질문할게요', message: null, icon: 'pen' },
    ];
  }

  // 기본값
  return [
    { label: '주요 정책이 궁금합니다', message: '주요 정책에 대해 설명해주실 수 있나요?', icon: 'building' },
    { label: '요즘 이슈에 대해 물어볼게요', message: '요즘 가장 중요하게 생각하시는 이슈가 뭔가요?', icon: 'comment' },
    { label: '자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?', icon: 'hand' },
    { label: '직접 질문할게요', message: null, icon: 'pen' },
  ];
}

function getIconSVG(icon: string) {
  switch (icon) {
    case 'building':
      return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>;
    case 'comment':
      return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'hand':
      return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M3 12c0-2 2-4 9-6 7 2 9 4 9 6M3 12a9 9 0 0 1 18 0"/></svg>;
    case 'pen':
      return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    default:
      return null;
  }
}

interface Props {
  politicianId: string;
  themeColor: string;
  onSelect: (message: string) => void;
  onDirectAsk: () => void;
}

export default function QuickMenu({ politicianId, themeColor, onSelect, onDirectAsk }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const items = getMenuItems(politicianId);

  if (dismissed) return null;

  const handleClick = (item: QuickMenuItem) => {
    setDismissed(true);
    if (item.message) {
      onSelect(item.message);
    } else {
      onDirectAsk();
    }
  };

  return (
    <div className="quick-menu-container">
      <div className="quick-menu-scroll">
        {items.map((item, i) => (
          <button
            key={i}
            className="quick-menu-btn flex items-center gap-2"
            style={{
              borderColor: themeColor,
              color: themeColor,
              animationDelay: `${i * 80}ms`,
            }}
            onClick={() => handleClick(item)}
          >
            <span className="flex-shrink-0">{getIconSVG(item.icon || 'pen')}</span>
            {item.label}
          </button>
        ))}
      </div>

      <style>{`
        .quick-menu-container {
          padding: 8px 12px 4px;
          overflow: hidden;
        }
        .quick-menu-scroll {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-bottom: 4px;
        }
        .quick-menu-btn {
          padding: 10px 16px;
          border-radius: 12px;
          border: 1.5px solid;
          background: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          text-align: left;
          transition: background 0.2s, color 0.2s;
          animation: quickMenuFadeIn 0.4s ease both;
          -webkit-tap-highlight-color: transparent;
        }
        .quick-menu-btn:active {
          background: ${themeColor};
          color: white;
        }
        @media (hover: hover) {
          .quick-menu-btn:hover {
            background: ${themeColor}15;
          }
        }
        @keyframes quickMenuFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

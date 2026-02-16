import { useState } from 'react';

interface QuickMenuItem {
  label: string;
  message: string | null; // null = direct ask (focus input)
}

function getMenuItems(politicianId: string): QuickMenuItem[] {
  // 대통령
  if (politicianId === 'leejm') {
    return [
      { label: '🏛️ 핵심 국정과제가 궁금합니다', message: '대통령님의 핵심 국정과제가 궁금합니다' },
      { label: '💬 요즘 가장 중요한 이슈가 뭔가요?', message: '요즘 가장 중요하게 생각하시는 이슈가 뭔가요?' },
      { label: '🙋 자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?' },
      { label: '✍️ 직접 질문할게요', message: null },
    ];
  }

  // 당대표
  if (politicianId === 'jungcr' || politicianId === 'jangdh') {
    return [
      { label: '🏛️ 당의 방향성이 궁금합니다', message: '앞으로 당을 어떤 방향으로 이끌어가실 건가요?' },
      { label: '💬 요즘 뜨는 이슈에 대해 어떻게 생각하세요?', message: '요즘 가장 뜨거운 이슈에 대해 어떻게 생각하세요?' },
      { label: '🙋 자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?' },
      { label: '✍️ 직접 질문할게요', message: null },
    ];
  }

  // 시장/구청장
  if (politicianId === 'ohsehoon' || politicianId === 'jungwono') {
    return [
      { label: '🏛️ 지역 정책이 궁금합니다', message: '요즘 가장 중점적으로 추진하시는 정책이 뭔가요?' },
      { label: '💬 우리 동네에 대해 물어볼게요', message: '우리 지역에서 요즘 가장 중요한 변화가 뭔가요?' },
      { label: '🙋 자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?' },
      { label: '✍️ 직접 질문할게요', message: null },
    ];
  }

  // 기본값
  return [
    { label: '🏛️ 주요 정책이 궁금합니다', message: '주요 정책에 대해 설명해주실 수 있나요?' },
    { label: '💬 요즘 이슈에 대해 물어볼게요', message: '요즘 가장 중요하게 생각하시는 이슈가 뭔가요?' },
    { label: '🙋 자기소개 부탁드려요', message: '자기소개 부탁드려도 될까요?' },
    { label: '✍️ 직접 질문할게요', message: null },
  ];
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
            className="quick-menu-btn"
            style={{
              borderColor: themeColor,
              color: themeColor,
              animationDelay: `${i * 80}ms`,
            }}
            onClick={() => handleClick(item)}
          >
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

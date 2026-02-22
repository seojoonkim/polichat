import { useNavigate } from 'react-router';
import { type DebateType } from './DebateView';

interface DebateBannerProps {
  debateType?: DebateType;
}

export default function DebateBanner({ debateType = 'seoul' }: DebateBannerProps) {
  const navigate = useNavigate();

  const config = {
    seoul: {
      candidateA: { name: '오세훈', party: '국민의힘', id: 'ohsehoon', color: '#E61E2B' },
      candidateB: { name: '정원오', party: '더불어민주당', id: 'jungwono', color: '#004EA2' },
      tagline: '"서울의 미래를 건다"',
    },
    national: {
      candidateA: { name: '정청래', party: '더불어민주당', id: 'jungcr', color: '#004EA2' },
      candidateB: { name: '장동혁', party: '국민의힘', id: 'jangdh', color: '#C9151E' },
      tagline: '"국회 격돌"',
    },
    leejeon: {
      candidateA: { name: '이준석', party: '개혁신당', id: 'leejunseok', color: '#FF6B35' },
      candidateB: { name: '전한길', party: '국민의힘', id: 'jeonhangil', color: '#C9151E' },
      tagline: '"보수 내전 🔥"',
    },
    kimjin: {
      candidateA: { name: '김어준', party: '정치비평가', id: 'kimeoojun', color: '#454545' },
      candidateB: { name: '진중권', party: '정치비평가', id: 'jinjungkwon', color: '#808080' },
      tagline: '"진보의 적은 누구인가"',
    },
    hanhong: {
      candidateA: { name: '한동훈', party: '국민의힘', id: 'handoonghoon', color: '#C9151E' },
      candidateB: { name: '홍준표', party: '국민의힘', id: 'hongjunpyo', color: '#8B0000' },
      tagline: '"보수의 미래를 건다"',
    },
  };

  const c = config[debateType] ?? config['seoul'];
  const navigationUrl = debateType === 'seoul' ? '/debate' : `/debate?type=${debateType}`;
  const uid = debateType;

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer mb-5 group bg-white border border-gray-100"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)', minHeight: '150px' }}
      onClick={() => navigate(navigationUrl)}
    >
      <style>{`
        @keyframes ringGlowA-${uid} {
          0%, 100% { box-shadow: 0 0 0 2.5px ${c.candidateA.color}99, 0 4px 16px ${c.candidateA.color}30; }
          50%       { box-shadow: 0 0 0 3px ${c.candidateA.color}CC, 0 4px 24px ${c.candidateA.color}55; }
        }
        @keyframes ringGlowB-${uid} {
          0%, 100% { box-shadow: 0 0 0 2.5px ${c.candidateB.color}99, 0 4px 16px ${c.candidateB.color}30; }
          50%       { box-shadow: 0 0 0 3px ${c.candidateB.color}CC, 0 4px 24px ${c.candidateB.color}55; }
        }
      `}</style>

      {/* 상단 태그라인 */}
      <div className="relative z-10 text-center pt-3 pb-0">
        <p className="text-violet-600 font-black text-[15px] tracking-tight">
          {c.tagline}
        </p>
      </div>

      {/* 메인 그리드 */}
      <div className="relative z-10 grid grid-cols-3 items-center px-4 py-3">

        {/* 후보 A */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-[86px] h-[86px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
            style={{ animation: `ringGlowA-${uid} 2.8s ease-in-out infinite` }}
          >
            <img
              src={`/politicians/${c.candidateA.id}/profile.jpg`}
              alt={c.candidateA.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <span className="text-gray-900 text-[15px] font-bold tracking-tight">{c.candidateA.name}</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: `${c.candidateA.color}15`, color: c.candidateA.color, border: `1px solid ${c.candidateA.color}40` }}
          >
            {c.candidateA.party}
          </span>
        </div>

        {/* VS + CTA */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="text-[30px] font-black leading-none tracking-tighter text-violet-600"
          >
            VS
          </div>
          <div className="text-gray-400 text-[10px] font-bold tracking-[0.12em] uppercase">AI 토론배틀</div>
          <button
            className="mt-1 px-4 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1 transition-all duration-200 group-hover:scale-105 bg-violet-600 text-white"
            style={{ boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }}
          >
            토론 시작
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* 후보 B */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-[86px] h-[86px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
            style={{
              animation: `ringGlowB-${uid} 2.8s ease-in-out infinite`,
              animationDelay: '1.4s',
            }}
          >
            <img
              src={`/politicians/${c.candidateB.id}/profile.jpg`}
              alt={c.candidateB.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <span className="text-gray-900 text-[15px] font-bold tracking-tight">{c.candidateB.name}</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: `${c.candidateB.color}15`, color: c.candidateB.color, border: `1px solid ${c.candidateB.color}40` }}
          >
            {c.candidateB.party}
          </span>
        </div>
      </div>

      <div className="pb-1" />
    </div>
  );
}

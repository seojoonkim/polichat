import { useNavigate } from 'react-router';

export default function DebateBanner() {
  const navigate = useNavigate();

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer mb-6 group"
      style={{
        background: 'linear-gradient(135deg, #C9151E 0%, #1a1a2e 50%, #004EA2 100%)',
        minHeight: '130px',
      }}
      onClick={() => navigate('/debate')}
    >
      {/* 배경 파티클 효과 */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 50%, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        {/* 오세훈 */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30 shadow-lg transition-transform duration-300 group-hover:scale-105"
            style={{ boxShadow: '0 0 16px #C9151E80' }}
          >
            <img
              src="/politicians/ohsehoon/profile.jpg"
              alt="오세훈"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">오세훈</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: '#C9151E40', color: '#ff9999', border: '1px solid #C9151E60' }}
          >
            국민의힘
          </span>
        </div>

        {/* 중앙 VS */}
        <div className="flex flex-col items-center gap-1 px-2">
          <div className="text-3xl font-black text-yellow-400 drop-shadow-lg tracking-tighter leading-none">
            VS
          </div>
          <div className="text-white text-xs font-bold tracking-wider opacity-80">
            🥊 AI 토론 배틀
          </div>
          <div
            className="mt-2 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-all duration-200 group-hover:scale-105"
            style={{
              background: 'rgba(255,215,0,0.2)',
              border: '1px solid rgba(255,215,0,0.6)',
              color: '#FFD700',
            }}
          >
            토론 시작 →
          </div>
        </div>

        {/* 정원오 */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30 shadow-lg transition-transform duration-300 group-hover:scale-105"
            style={{ boxShadow: '0 0 16px #004EA280' }}
          >
            <img
              src="/politicians/jungwono/profile.jpg"
              alt="정원오"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">정원오</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: '#004EA240', color: '#99bbff', border: '1px solid #004EA260' }}
          >
            더불어민주당
          </span>
        </div>
      </div>

      {/* 하단 문구 */}
      <div className="relative z-10 text-center pb-3">
        <p className="text-white/60 text-xs">"서울의 미래를 건다"</p>
      </div>
    </div>
  );
}

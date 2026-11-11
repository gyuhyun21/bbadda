// save pool 3차 모션 장면(SCENES-batch3.md, PR #319). 사실은 리서처 bbadda-pool-facts 5·6·8·10편.
// 위(제목, y<600)·아래(하단 자막, y>1250)는 비우고 가운데에만 그린다. 시각은 장면 길이에 대한 비율로 잡아 --props seconds 가 바뀌어도 맞는다.
import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { usePretendard } from './font';

export type SceneProps = { seconds?: number };
const Y = '#ffe03a', R = '#d70015', DIM = 'rgba(255,255,255,.14)';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
// 장면 길이의 a~b 비율 구간에서 0→1
const useT = () => {
  const f = useCurrentFrame(), { durationInFrames: d } = useVideoConfig();
  return (a: number, b: number, ease = Easing.out(Easing.cubic)) => interpolate(f, [a * d, Math.max(b * d, a * d + 1)], [0, 1], { ...clamp, easing: ease });
};
const pop = (t: number) => interpolate(t, [0, 0.6, 1], [0.4, 1.15, 1], clamp);
const Frame = ({ children }: { children: ReactNode }) => {
  usePretendard();
  return <AbsoluteFill style={{ background: '#111', fontFamily: 'P', color: '#fff', wordBreak: 'keep-all' }}>{children}</AbsoluteFill>;
};
const Stamp = ({ t, text, top }: { t: number; text: string; top: number }) => (
  <div style={{ position: 'absolute', top, width: '100%', textAlign: 'center', opacity: t > 0 ? 1 : 0 }}>
    <span style={{ display: 'inline-block', transform: `rotate(-10deg) scale(${pop(t)})`, border: `10px solid ${R}`, color: R, borderRadius: 24, padding: '10px 40px', fontSize: 110, fontWeight: 900 }}>{text}</span>
  </div>
);

// 5편 ④ 1998.9.19 에서 멈추고 9.20 에 빨간 X, '본인 선택' 도장
export const RipkenEnd = (_: SceneProps) => {
  const t = useT(), x = t(0.25, 0.45), s = t(0.55, 0.7);
  const cell = (date: string, sub: string, on: boolean) => (
    <div style={{ width: 380, height: 380, borderRadius: 32, background: on ? Y : DIM, color: on ? '#111' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 44, fontWeight: 700, opacity: 0.8 }}>1998</div>
      <div style={{ fontSize: 130, fontWeight: 900, lineHeight: 1.05 }}>{date}</div>
      <div style={{ fontSize: 40, fontWeight: 700 }}>{sub}</div>
    </div>
  );
  return (
    <Frame>
      <div style={{ position: 'absolute', top: 660, left: 100, right: 100, display: 'flex', justifyContent: 'space-between' }}>
        {cell('9.19', '2,632번째', true)}
        <div style={{ position: 'relative' }}>
          {cell('9.20', '', false)}
          {[45, -45].map((r) => <div key={r} style={{ position: 'absolute', left: -20, top: 175, width: 420 * x, height: 26, borderRadius: 13, background: R, transform: `rotate(${r}deg)`, transformOrigin: '210px 13px' }} />)}
        </div>
      </div>
      <Stamp t={s} text="본인 선택" top={1080} />
    </Frame>
  );
};

// 6편 ② 일본 55 막대 → 이승엽 55에서 멈칫 → 56, '당시 아시아 최다'
export const LeeBar = (_: SceneProps) => {
  const t = useT(), w = 720 / 56;
  const jp = 55 * t(0.05, 0.3), lee = 55 * t(0.25, 0.55) + t(0.68, 0.75, Easing.out(Easing.back(3))), tag = t(0.8, 0.9);
  const bar = (label: string, n: number, color: string, top: number, shown: number) => (
    <div style={{ position: 'absolute', top, left: 90 }}>
      <div style={{ fontSize: 46, fontWeight: 700, marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: n * w, height: 110, borderRadius: 18, background: color }} />
        <span style={{ fontSize: 96, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
      </div>
    </div>
  );
  return (
    <Frame>
      {bar('일본 기록', jp, '#9a9a9a', 640, Math.round(jp))}
      {bar('이승엽 2003', lee, Y, 900, Math.round(lee))}
      <div style={{ position: 'absolute', top: 1180, right: 90, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)`, background: Y, color: '#111', fontSize: 44, fontWeight: 900, padding: '8px 24px', borderRadius: 12 }}>당시 아시아 최다</div>
    </Frame>
  );
};

// 6편 ④ 관중석 위로 잠자리채가 올라오고 빨간 금지 표시가 덮인다
export const NetBan = (_: SceneProps) => {
  const t = useT(), up = t(0, 0.35), ban = t(0.45, 0.6);
  return (
    <Frame>
      <svg width={1080} height={1920} style={{ position: 'absolute' }}>
        {Array.from({ length: 3 }, (_, r) => Array.from({ length: 9 }, (_, c) => <circle key={`${r}-${c}`} cx={100 + c * 110 + (r % 2) * 55} cy={1150 + r * 60} r={34} fill="rgba(255,255,255,.18)" />))}
        <g transform={`translate(0 ${(1 - up) * 400})`}>
          <line x1={640} y1={1180} x2={540} y2={900} stroke="#bbb" strokeWidth={18} strokeLinecap="round" />
          <circle cx={490} cy={790} r={130} fill="none" stroke={Y} strokeWidth={16} />
          {[-80, -40, 0, 40, 80].map((d) => <line key={`v${d}`} x1={490 + d} y1={670} x2={490 + d} y2={910} stroke="rgba(255,224,58,.6)" strokeWidth={5} />)}
          {[-80, -40, 0, 40, 80].map((d) => <line key={`h${d}`} x1={370} y1={790 + d} x2={610} y2={790 + d} stroke="rgba(255,224,58,.6)" strokeWidth={5} />)}
        </g>
        <g opacity={ban > 0 ? 1 : 0} transform={`translate(540 860) scale(${pop(ban)})`}>
          <circle r={290} fill="none" stroke={R} strokeWidth={44} />
          <line x1={-205} y1={-205} x2={205} y2={205} stroke={R} strokeWidth={44} />
        </g>
      </svg>
    </Frame>
  );
};

// 다이아몬드 공통: 홈(아래)·1루(오른쪽)·2루(위)·3루(왼쪽)
const B = { home: [540, 1180], first: [820, 900], second: [540, 620], third: [260, 900] } as const;
const Field = ({ children, red }: { children?: ReactNode; red?: boolean }) => (
  <svg width={1080} height={1920} style={{ position: 'absolute' }}>
    <polygon points={[B.home, B.first, B.second, B.third].map((p) => p.join(',')).join(' ')} fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.35)" strokeWidth={6} />
    {(['first', 'second', 'third'] as const).map((k) => <rect key={k} x={B[k][0] - 30} y={B[k][1] - 30} width={60} height={60} transform={`rotate(45 ${B[k][0]} ${B[k][1]})`} fill={k === 'first' && red ? R : '#fff'} />)}
    <polygon points={`${B.home[0] - 32},${B.home[1] - 20} ${B.home[0] + 32},${B.home[1] - 20} ${B.home[0] + 32},${B.home[1] + 5} ${B.home[0]},${B.home[1] + 30} ${B.home[0] - 32},${B.home[1] + 5}`} fill="#fff" />
    {children}
  </svg>
);

// 8편 ② 주자가 홈→1→2→3→홈 순서로 노란 선, 지나간 베이스에 체크
export const Diamond = (_: SceneProps) => {
  const t = useT(), p = t(0.08, 0.85, Easing.inOut(Easing.quad)) * 4;
  const path = [B.home, B.first, B.second, B.third, B.home];
  const seg = Math.min(Math.floor(p), 3), f = p - seg;
  const [ax, ay] = path[seg], [bx, by] = path[seg + 1];
  const rx = ax + (bx - ax) * f, ry = ay + (by - ay) * f;
  const drawn = path.slice(0, seg + 1).map((q) => q.join(',')).join(' ') + ` ${rx},${ry}`;
  return (
    <Frame>
      <Field>
        <polyline points={drawn} fill="none" stroke={Y} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
        {path.slice(1).map((q, i) => p >= i + 1 && <text key={i} x={q[0] + (i === 3 ? 0 : 60)} y={q[1] + (i === 3 ? -50 : -40)} fontSize={70} fill={Y} fontWeight={900} textAnchor="middle">✓</text>)}
        <circle cx={rx} cy={ry} r={30} fill={Y} stroke="#111" strokeWidth={6} />
      </Field>
    </Frame>
  );
};

// 8편 ④ 1루만 빨갛게 깜빡 → 수비 쪽 '어필!' 말풍선 → 'OUT' 도장
export const Appeal = (_: SceneProps) => {
  const f = useCurrentFrame(), t = useT(), say = t(0.3, 0.42), out = t(0.6, 0.72);
  return (
    <Frame>
      <Field red={Math.floor(f / 8) % 2 === 0} />
      <div style={{ position: 'absolute', top: 700, right: 40, opacity: say, transform: `scale(${pop(say)})`, background: '#fff', color: '#111', fontSize: 64, fontWeight: 900, padding: '18px 34px', borderRadius: 40 }}>어필!</div>
      <Stamp t={out} text="OUT" top={820} />
    </Frame>
  );
};

// 상의 아이콘(같은 노란 유니폼)
const Shirt = ({ bat, dim }: { bat?: boolean; dim?: boolean }) => (
  <svg width={150} height={150} viewBox="0 0 100 100">
    <path d="M30 15 L45 10 Q50 18 55 10 L70 15 L90 35 L78 47 L72 40 L72 90 L28 90 L28 40 L22 47 L10 35 Z" fill={dim ? '#666' : Y} />
    {bat && <line x1={80} y1={90} x2={98} y2={20} stroke="#c8a165" strokeWidth={7} strokeLinecap="round" />}
  </svg>
);

// 10편 ② 1870년대 선수 겸 감독 → 지금 감독, 유니폼은 그대로
export const Timeline = (_: SceneProps) => {
  const t = useT(), line = t(0.05, 0.75, Easing.inOut(Easing.quad));
  const nodes: [string, string, boolean][] = [['1870년대', '선수 겸 감독', true], ['1900년대', '', true], ['1950년대', '', false], ['지금', '감독', false]];
  return (
    <Frame>
      <div style={{ position: 'absolute', top: 960, left: 90, width: 900 * line, height: 10, borderRadius: 5, background: Y }} />
      {nodes.map(([y, label, bat], i) => {
        const on = t(0.05 + i * 0.2, 0.15 + i * 0.2);
        return (
          <div key={y} style={{ position: 'absolute', top: 760, left: 90 + i * 300 - 75, width: 150, textAlign: 'center', opacity: on, transform: `translateY(${(1 - on) * 30}px)` }}>
            <Shirt bat={bat} />
            <div style={{ fontSize: 40, fontWeight: 800, marginTop: 70 }}>{y}</div>
            {label && <div style={{ fontSize: 34, fontWeight: 700, color: Y, whiteSpace: 'nowrap', marginLeft: -40, marginRight: -40 }}>{label}</div>}
          </div>
        );
      })}
      <div style={{ position: 'absolute', top: 1160, width: '100%', textAlign: 'center', fontSize: 48, fontWeight: 800, opacity: t(0.8, 0.9) }}>유니폼은 그대로</div>
    </Frame>
  );
};

// 10편 ③ 같은 유니폼 점들 사이로 감독 점이 더그아웃에서 마운드로 걸어 나가고, 펜스 밖 회색 정장과 대비
export const OnField = (_: SceneProps) => {
  const t = useT(), walk = t(0.15, 0.7, Easing.inOut(Easing.quad)), suit = t(0.5, 0.65);
  const players: [number, number][] = [[540, 880], [800, 860], [640, 720], [440, 720], [280, 860], [540, 1150], [300, 650], [540, 600], [780, 650]];
  const mx = 900 + (540 - 900) * walk, my = 1150 + (880 - 1150) * walk + Math.sin(walk * Math.PI) * -40;
  return (
    <Frame>
      <Field>
        {players.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={26} fill={Y} opacity={0.75} />)}
        <circle cx={mx} cy={my} r={34} fill={Y} stroke="#fff" strokeWidth={8} />
        <text x={mx} y={my - 54} fontSize={46} fontWeight={900} fill="#fff" textAnchor="middle">감독</text>
        <g opacity={suit}>
          <rect x={60} y={1120} width={120} height={70} rx={14} fill="#555" />
          <text x={120} y={1100} fontSize={40} fontWeight={800} fill="#aaa" textAnchor="middle">정장?</text>
        </g>
      </Field>
    </Frame>
  );
};

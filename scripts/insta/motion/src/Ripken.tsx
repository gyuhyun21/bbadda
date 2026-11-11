// 칼 립켄 2,632경기 연속 출전(1982-05-30~1998-09-19, 리서처 bbadda-pool-facts 5편): 숫자가 0→2,632로 오르고 칸이 차례로 찬다.
// 위(제목, y<600)·아래(하단 자막, y>1250)는 비워 둔다 — reel-make.ts 가 그 위에 글을 얹는다.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { usePretendard } from './font';

export type RipkenProps = { seconds?: number };
const TOTAL = 2632, COLS = 28, ROWS = 10; // 칸 하나 ≈ 9.4경기(그림일 뿐 경기 수 단위 아님)

export const Ripken = (_: RipkenProps) => {
  usePretendard();
  const frame = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  // 마지막 0.6초는 2,632 에서 멈춰 읽히게 둔다
  const p = interpolate(frame, [6, Math.max(durationInFrames - 18, 7)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const n = Math.round(p * TOTAL), filled = Math.round(p * COLS * ROWS), done = p >= 1;
  const pop = done ? interpolate(frame - (durationInFrames - 18), [0, 4, 8], [1, 1.12, 1], { extrapolateRight: 'clamp' }) : 1;
  return (
    <AbsoluteFill style={{ background: '#111', fontFamily: 'P', color: '#fff', wordBreak: 'keep-all' }}>
      <div style={{ position: 'absolute', top: 640, width: '100%', textAlign: 'center', fontSize: 210, fontWeight: 900, letterSpacing: '-0.03em', color: done ? '#ffe03a' : '#fff', transform: `scale(${pop})`, fontVariantNumeric: 'tabular-nums' }}>
        {n.toLocaleString('en-US')}<span style={{ fontSize: 90, marginLeft: 10 }}>경기</span>
      </div>
      <div style={{ position: 'absolute', top: 900, left: 90, width: 900, display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6 }}>
        {Array.from({ length: COLS * ROWS }, (_, k) => (
          <div key={k} style={{ height: 18, borderRadius: 4, background: k < filled ? '#ffe03a' : 'rgba(255,255,255,.12)' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', top: 1160, left: 90, right: 90, display: 'flex', justifyContent: 'space-between', fontSize: 34, fontWeight: 700, opacity: 0.8 }}>
        <span>1982.5.30</span><span>1998.9.19</span>
      </div>
    </AbsoluteFill>
  );
};

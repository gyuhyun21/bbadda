// 릴스 '우리 화면' 모션 템플릿 5개(2026-11-26 센세 요청, 릴스 시험 PR #430). scripts/insta/motion-render.sh 가 props 를 검사·정리해서 넘긴다.
// 위 30%(y<576, head 자막)·아래 25%(y>1440, sub 자막)는 비우고 가운데에만 그린다. 구단 로고·선수 사진 없이 글자·색·도형만.
// 숫자는 props 그대로 보여 준다(계산은 루틴이 하고 캡션에 계산식). 세는 움직임 중간값만 만들고 마지막 화면은 원래 글자 그대로.
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, DIM, Frame, pop, R, useT, Y, type SceneProps } from './Pool3';

const GRAY = '#8a8a8a', TOP = 600, BOTTOM = 1420;
// 글자 폭 어림(한글 1em, 그 밖 0.6em)으로 width 안에 들어가는 글자 크기
const fit = (text: string, max: number, width: number) => {
  const em = [...text].reduce((a, c) => a + (/[가-힣ㄱ-ㅎ]/.test(c) ? 1 : c === ' ' ? 0.3 : 0.6), 0);
  return Math.min(max, Math.floor(width / Math.max(em, 1)));
};
// '548' '4,000' '12.5' 같은 맨 앞 숫자를 0부터 세어 올린다(쉼표·소수 자리 유지). t>=1 이면 원래 글자
const countUp = (v: string, t: number) => {
  const m = v.match(/^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/s);
  if (!m || t >= 1) return v;
  const dec = (m[2].split('.')[1] ?? '').length, n = Number(m[2].replace(/,/g, '')) * t;
  const s = m[2].includes(',') ? n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : n.toFixed(dec);
  return m[1] + s + m[3];
};
const num = (v: string) => Number(v.match(/-?\d[\d,]*(?:\.\d+)?/)?.[0].replace(/,/g, '') ?? NaN);
const rise = (t: number) => ({ opacity: t, transform: `translateY(${(1 - t) * 50}px)` });

// 1. stat — 큰 숫자 카운트업 + 단위 + 한 줄 설명. 예: 하루 / 548만 원 / 하루에 버는 돈
export type StatProps = SceneProps & { value: string; unit?: string; label: string; prefix?: string };
export const Stat = ({ value, unit = '', label, prefix }: StatProps) => {
  const t = useT(), c = t(0.05, 0.5, Easing.out(Easing.quad)), hit = t(0.5, 0.6), lab = t(0.45, 0.62), line = t(0.55, 0.75);
  const vs = fit(value + unit, 300, 900), us = Math.round(vs * 0.42);
  return (
    <Frame>
      {prefix && <div style={{ position: 'absolute', top: TOP + 40, width: '100%', textAlign: 'center', fontSize: 60, fontWeight: 700, color: '#bbb', ...rise(t(0, 0.12)) }}>{prefix}</div>}
      <div style={{ position: 'absolute', top: 760, width: '100%', textAlign: 'center', whiteSpace: 'nowrap', transform: `scale(${interpolate(hit, [0, 0.5, 1], [1, 1.08, 1])})` }}>
        <span style={{ fontSize: vs, fontWeight: 900, color: Y, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{countUp(value, c)}</span>
        {unit && <span style={{ fontSize: us, fontWeight: 800, marginLeft: 12 }}>{unit}</span>}
      </div>
      <div style={{ position: 'absolute', top: 1150, width: '100%', textAlign: 'center', ...rise(lab) }}>
        <span style={{ fontSize: fit(label, 68, 900), fontWeight: 800 }}>{label}</span>
        <div style={{ margin: '24px auto 0', width: 360 * line, height: 12, borderRadius: 6, background: Y }} />
      </div>
    </Frame>
  );
};

// 2. compare — 2~3개 막대 나란히, 가장 큰 값(또는 highlight) 강조
export type CompareItem = { name: string; value: string; unit?: string; note?: string };
export type CompareProps = SceneProps & { items: CompareItem[]; highlight?: number }; // highlight = items 의 0부터 번호(motion-render.sh 가 이름·순번을 바꿔 줌)
export const Compare = ({ items, highlight }: CompareProps) => {
  const t = useT(), ns = items.map((i) => num(i.value)), ok = ns.every((n) => Number.isFinite(n) && n >= 0), max = Math.max(...ns);
  const hi = highlight ?? ns.indexOf(max), h = Math.min(300, (BOTTOM - TOP - 40) / items.length);
  return (
    <Frame>
      {items.map((it, i) => {
        const g = t(0.05 + i * 0.12, 0.4 + i * 0.12), on = i === hi, bump = on ? t(0.62, 0.74) : 0;
        const w = 900 * (ok && max > 0 ? ns[i] / max : 1) * g;
        return (
          <div key={i} style={{ position: 'absolute', top: TOP + 20 + i * h, left: 90, width: 900, opacity: interpolate(g, [0, 0.2], [0, 1], clamp) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: fit(it.name, 52, 420), fontWeight: 700, color: on ? '#fff' : '#bbb' }}>{it.name}</span>
              <span style={{ display: 'inline-block', transform: `scale(${interpolate(bump, [0, 0.5, 1], [1, 1.15, 1])})`, transformOrigin: 'right bottom' }}>
                <span style={{ fontSize: fit(it.value + (it.unit ?? ''), 100, 470), fontWeight: 900, color: on ? Y : '#fff', fontVariantNumeric: 'tabular-nums' }}>{countUp(it.value, g)}</span>
                {it.unit && <span style={{ fontSize: 46, fontWeight: 800, marginLeft: 8, color: on ? Y : '#fff' }}>{it.unit}</span>}
              </span>
            </div>
            <div style={{ marginTop: 14, width: Math.max(w, 8), height: 56, borderRadius: 28, background: on ? Y : GRAY }} />
            {it.note && <div style={{ marginTop: 12, fontSize: 38, fontWeight: 600, color: '#aaa', whiteSpace: 'nowrap' }}>{it.note}</div>}
          </div>
        );
      })}
    </Frame>
  );
};

// 3. rank — 순위 3~5줄. 아래 줄부터 한 줄씩 올라오고 1위가 마지막
export type RankProps = SceneProps & { title?: string; items: { rank: string; name: string; value: string }[] };
export const Rank = ({ title, items }: RankProps) => {
  const t = useT(), n = items.length, top = title ? TOP + 100 : TOP + 40, h = Math.min(150, (BOTTOM - top) / n);
  return (
    <Frame>
      {title && <div style={{ position: 'absolute', top: TOP + 10, width: '100%', textAlign: 'center', fontSize: fit(title, 60, 900), fontWeight: 800, color: Y, ...rise(t(0, 0.1)) }}>{title}</div>}
      {items.map((it, i) => {
        const k = n - 1 - i, g = t(0.08 + k * (0.55 / n), 0.08 + (k + 1) * (0.55 / n)), first = i === 0;
        return (
          <div key={i} style={{ position: 'absolute', top: top + i * h, left: 70, right: 70, height: h - 22, display: 'flex', alignItems: 'center', gap: 28, padding: '0 30px', borderRadius: 24, background: first ? 'rgba(255,224,58,.12)' : 'rgba(255,255,255,.06)', whiteSpace: 'nowrap', ...rise(g) }}>
            <div style={{ minWidth: 100, height: 100, padding: '0 12px', borderRadius: 22, background: first ? Y : DIM, color: first ? '#111' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fit(it.rank, 60, 120), fontWeight: 900 }}>{it.rank}</div>
            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: fit(it.name, 60, 480), fontWeight: 800 }}>{it.name}</div>
            <div style={{ fontSize: fit(it.value, 60, 330), fontWeight: 900, color: first ? Y : '#fff', fontVariantNumeric: 'tabular-nums' }}>{it.value}</div>
          </div>
        );
      })}
    </Frame>
  );
};

// 4. quiz — 단서 2~3줄이 먼저, revealAt 초에 번쩍 + 정답 확대. 그 전까지 물음표 칸과 줄어드는 시간 막대
export type QuizProps = SceneProps & { clues: string[]; answer: string; revealAt: number };
export const Quiz = ({ clues, answer, revealAt }: QuizProps) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), r = revealAt * fps, t = useT();
  const shown = interpolate(f, [r, r + 0.4 * fps], [0, 1], clamp), flash = interpolate(f, [r, r + 0.25 * fps], [0.9, 0], clamp), left = interpolate(f, [0.3 * fps, r], [1, 0], clamp);
  return (
    <Frame>
      {clues.map((c, i) => {
        const a = (i * 0.8 * r) / clues.length, g = interpolate(f, [a, a + 0.3 * fps], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        return <div key={i} style={{ position: 'absolute', top: TOP + 20 + i * 130, left: 90, right: 90, padding: '18px 32px', borderRadius: 24, background: DIM, fontSize: fit(c, 58, 840), fontWeight: 800, whiteSpace: 'nowrap', ...rise(g) }}><span style={{ color: Y, marginRight: 18 }}>{i + 1}</span>{c}</div>;
      })}
      <div style={{ position: 'absolute', top: 1060, left: 90, right: 90, height: 300, borderRadius: 32, border: `8px solid ${shown > 0 ? Y : DIM}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: t(0, 0.08) }}>
        {shown > 0
          ? <span style={{ fontSize: fit(answer, 170, 840), fontWeight: 900, color: Y, whiteSpace: 'nowrap', transform: `scale(${pop(shown)})` }}>{answer}</span>
          : <span style={{ fontSize: 200, fontWeight: 900, color: GRAY, transform: `scale(${1 + 0.06 * Math.sin(f / 4)})` }}>?</span>}
      </div>
      {shown === 0 && <div style={{ position: 'absolute', top: 1385, left: 90, width: 900 * left, height: 14, borderRadius: 7, background: R }} />}
      <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: f >= r ? flash : 0 }} />
    </Frame>
  );
};

// 5. board — 10개 구단 표(팀 이름 글자 + 팀 색 띠만, 로고 금지), 들어옴/나감 칸. 팀 짧은 이름·색은 motion-render.sh 가 config/teams.yaml 에서 넣는다
export type BoardProps = SceneProps & { rows: { team: string; in: string; out: string; short: string; color: string; dark?: boolean }[] };
export const Board = ({ rows }: BoardProps) => {
  const t = useT(), hd = 64, h = Math.min(76, (BOTTOM - TOP - hd) / rows.length);
  const cell = { fontSize: 36, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
  return (
    <Frame>
      <div style={{ position: 'absolute', top: TOP, left: 60, right: 60, height: hd, display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 800, color: '#bbb', opacity: t(0, 0.08) }}>
        <div style={{ width: 230, paddingLeft: 30 }}>팀</div>
        <div style={{ width: 365 }}><span style={{ color: Y }}>▲</span> 들어옴</div>
        <div style={{ width: 365 }}><span style={{ color: R }}>▼</span> 나감</div>
      </div>
      {rows.map((r, i) => {
        const g = t(0.04 + i * 0.035, 0.16 + i * 0.035);
        return (
          <div key={i} style={{ position: 'absolute', top: TOP + hd + i * h, left: 60, right: 60, height: h - 8, display: 'flex', alignItems: 'center', borderRadius: 14, background: i % 2 ? 'transparent' : 'rgba(255,255,255,.06)', opacity: g, transform: `translateX(${(1 - g) * -60}px)` }}>
            <div style={{ width: 230, display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 12 }}>
              <div style={{ width: 14, height: h - 30, borderRadius: 7, background: r.color, boxShadow: r.dark ? '0 0 0 3px rgba(255,255,255,.85)' : '0 0 0 2px rgba(255,255,255,.25)' }} />
              <span style={{ ...cell, fontSize: 40, fontWeight: 900 }}>{r.short}</span>
            </div>
            <div style={{ ...cell, width: 365, paddingRight: 16, color: r.in === '—' ? '#666' : '#fff' }}>{r.in}</div>
            <div style={{ ...cell, width: 365, paddingRight: 16, color: r.out === '—' ? '#666' : '#fff' }}>{r.out}</div>
          </div>
        );
      })}
    </Frame>
  );
};

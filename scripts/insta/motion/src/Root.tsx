// shortcut: Remotion 4.0.542 는 프로젝트 경로에 한글이 있으면 렌더가 멈춘다(맥미니 영문 경로는 괜찮음) — 한글 경로에서 써야 하면 영문 경로 사본에서 렌더.
// 장면마다 Composition 하나. 길이는 --props='{"seconds":6}' 로 그 장면 목소리 길이(+0.25초 이상)에 맞춘다.
import { Composition } from 'remotion';
import { Ripken, type RipkenProps } from './Ripken';
import { Appeal, Diamond, LeeBar, NetBan, OnField, RipkenEnd, Timeline } from './Pool3';
import { Board, Compare, Quiz, Rank, Stat } from './Templates';

const sec = (p: { seconds?: number }) => ({ durationInFrames: Math.round((p.seconds ?? 5) * 30) });

// 우리 화면 템플릿(2026-11-26) — props 는 scripts/insta/motion-render.sh 가 검사해 넘긴다. 아래 기본값은 studio 미리보기용
const templates = {
  stat: [Stat, { prefix: '예시', value: '123', unit: '만 원', label: '설명 한 줄' }],
  compare: [Compare, { items: [{ name: '선수A', value: '30', unit: '억', note: '2년' }, { name: '선수B', value: '50', unit: '억', note: '4년' }, { name: '선수C', value: '10', unit: '억' }] }],
  rank: [Rank, { title: '예시 순위', items: [{ rank: '1', name: '선수A', value: '50억' }, { rank: '2', name: '선수B', value: '30억' }, { rank: '3', name: '선수C', value: '10억' }] }],
  quiz: [Quiz, { clues: ['단서 하나', '단서 둘', '단서 셋'], answer: '정답', revealAt: 3 }],
  board: [Board, { rows: [{ team: 'kt', short: 'KT', color: '#000000', dark: true, in: '선수A', out: '—' }] }],
} as const;

const pool3 = { 'ripken-end': RipkenEnd, 'lee-bar': LeeBar, 'net-ban': NetBan, diamond: Diamond, appeal: Appeal, timeline: Timeline, 'on-field': OnField };

export const Root = () => (
  <>
    <Composition id="ripken" component={Ripken} width={1080} height={1920} fps={30} durationInFrames={150}
      defaultProps={{ seconds: 5 } as RipkenProps} calculateMetadata={({ props }) => sec(props)} />
    {Object.entries(pool3).map(([id, C]) => (
      <Composition key={id} id={id} component={C} width={1080} height={1920} fps={30} durationInFrames={150}
        defaultProps={{ seconds: 5 }} calculateMetadata={({ props }) => sec(props)} />
    ))}
    {Object.entries(templates).map(([id, [C, p]]) => (
      <Composition key={id} id={id} component={C as React.FC<object>} width={1080} height={1920} fps={30} durationInFrames={150}
        defaultProps={{ seconds: 5, ...p }} calculateMetadata={({ props }) => sec(props)} />
    ))}
  </>
);

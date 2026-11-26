// shortcut: Remotion 4.0.542 는 프로젝트 경로에 한글이 있으면 렌더가 멈춘다(맥미니 영문 경로는 괜찮음) — 한글 경로에서 써야 하면 영문 경로 사본에서 렌더.
// 장면마다 Composition 하나. 길이는 --props='{"seconds":6}' 로 그 장면 목소리 길이(+0.25초 이상)에 맞춘다.
import { Composition } from 'remotion';
import { Ripken, type RipkenProps } from './Ripken';
import { Appeal, Diamond, LeeBar, NetBan, OnField, RipkenEnd, Timeline } from './Pool3';
import { Board, Compare, Quiz, Rank, Stat } from './Templates';

const sec = (p: { seconds?: number }) => ({ durationInFrames: Math.round((p.seconds ?? 5) * 30) });

// 우리 화면 템플릿(2026-11-26) — props 는 scripts/insta/motion-render.sh 가 검사해 넘긴다. 아래 기본값은 studio 미리보기용
const templates = {
  stat: [Stat, { prefix: '하루', value: '548', unit: '만 원', label: '하루에 버는 돈' }],
  compare: [Compare, { items: [{ name: '양의지', value: '55', unit: '억', note: '2년' }, { name: '최지훈', value: '67', unit: '억', note: '4년' }, { name: '오태곤', value: '11', unit: '억', note: '3년' }] }],
  rank: [Rank, { title: 'FA 계약 총액', items: [{ rank: '1', name: '최지훈', value: '67억' }, { rank: '2', name: '양의지', value: '55억' }, { rank: '3', name: '문승원', value: '15억' }] }],
  quiz: [Quiz, { clues: ['4년 계약', '총액 67억', 'SSG 잔류'], answer: '최지훈', revealAt: 3 }],
  board: [Board, { rows: [{ team: 'ssg', short: 'SSG', color: '#CE0E2D', in: '—', out: '—' }] }],
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

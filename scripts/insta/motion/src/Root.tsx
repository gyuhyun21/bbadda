// shortcut: Remotion 4.0.542 는 프로젝트 경로에 한글이 있으면 렌더가 멈춘다(맥미니 영문 경로는 괜찮음) — 한글 경로에서 써야 하면 영문 경로 사본에서 렌더.
// 장면마다 Composition 하나. 길이는 --props='{"seconds":6}' 로 그 장면 목소리 길이(+0.25초 이상)에 맞춘다.
import { Composition } from 'remotion';
import { Ripken, type RipkenProps } from './Ripken';

const sec = (p: { seconds?: number }) => ({ durationInFrames: Math.round((p.seconds ?? 5) * 30) });

export const Root = () => (
  <Composition id="ripken" component={Ripken} width={1080} height={1920} fps={30} durationInFrames={150}
    defaultProps={{ seconds: 5 } as RipkenProps} calculateMetadata={({ props }) => sec(props)} />
);

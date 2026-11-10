// --public-dir 가 저장소 public/ 이라 사이트·릴스와 같은 Pretendard 를 쓴다. 글꼴이 다 받아질 때까지 렌더를 멈춘다.
import { useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

let loading: Promise<void> | undefined;
export const usePretendard = () => {
  useState(() => {
    const wait = delayRender('Pretendard');
    loading ??= new FontFace('P', `url(${staticFile('fonts/pretendard/PretendardVariable.subset.woff2')})`, { weight: '100 900' }).load().then((f) => { document.fonts.add(f); });
    loading.then(() => continueRender(wait), cancelRender);
    return null;
  });
};

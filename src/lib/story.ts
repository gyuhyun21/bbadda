// "같은 소식" 판정: 매체마다 제목이 조금씩 달라도 핵심 단어가 대부분 겹치면 같은 기사로 본다.
// 예) "휴롬 유승현 품질본부장, 전자·IT의 날 산업부장관 표창 수상" ↔ "휴롬 유승현 품질본부장 산업부장관 표창 수상"

const PARTICLE = /(은|는|이|가|을|를|의|에|에서|와|과|도|로|으로|까지|부터)$/;
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'at', 'from', 'as', 'its', 'is', 'are', 'new', '기사', '뉴스', '속보', '단독', '종합']);

/** 제목 끝의 " - 매체명" 을 떼고, 2글자 이상 핵심 단어 집합을 만든다. */
export function storyTokens(title: string): Set<string> {
  const t = title.replace(/\s[-–|]\s[^-–|]+$/, '').toLowerCase();
  const out = new Set<string>();
  for (let w of t.split(/[^\p{L}\p{N}]+/u)) {
    if (/[가-힣]/.test(w) && w.length >= 3) w = w.replace(PARTICLE, '');
    if (w.length >= 2 && !STOP.has(w)) out.add(w);
  }
  return out;
}

export type StoryLike = { title: string; market: string; published_at: string };

/** 같은 시장, 게시일 4일 이내, 핵심 단어 3개 이상 공유 + 짧은 쪽 기준 60% 이상 겹침 */
export function sameStory(a: StoryLike, b: StoryLike, opts = { minShared: 3, minOverlap: 0.6, maxDays: 4 }): boolean {
  if (a.market !== b.market) return false;
  const dt = Math.abs(Date.parse(a.published_at) - Date.parse(b.published_at));
  if (Number.isFinite(dt) && dt > opts.maxDays * 86400000) return false;
  const A = storyTokens(a.title);
  const B = storyTokens(b.title);
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  const minSize = Math.min(A.size, B.size);
  return minSize > 0 && shared >= opts.minShared && shared / minSize >= opts.minOverlap;
}

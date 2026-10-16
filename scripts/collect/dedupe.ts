import type { Signal } from '../../src/lib/schemas.ts';
import { normalizeUrl, titleSimilarity, type RawItem } from './util.ts';
import { sameStory as same } from '../../src/lib/story.ts';
// 시장 구분이 없는 사이트라 모두 같은 시장으로 본다
const sameStory = (a: { title: string; published_at: string }, b: { title: string; published_at: string }) => same({ ...a, market: 'kr' }, { ...b, market: 'kr' });

export const SIMILARITY = 0.85;
const PRIORITY: Record<string, number> = { youtube: 0, instagram: 1, community: 2, news: 3 };

export type Cand = { raw: RawItem; cluster: number; also: { source_name: string; url: string }[] };

/** 1) 배치 내 URL·제목·같은 소식 병합(클러스터 크기와 다른 매체 기록) 2) 이전 4주·이번 주 기존 signal과 겹치면 제거 */
export function dedupe(items: RawItem[], existing: Pick<Signal, 'url' | 'title' | 'published_at'>[]) {
  const seenUrl = new Set(existing.map((s) => normalizeUrl(s.url)));
  const sorted = [...items].sort((a, b) => (PRIORITY[a.source_type] ?? 9) - (PRIORITY[b.source_type] ?? 9) || Date.parse(a.published_at) - Date.parse(b.published_at));
  const kept: Cand[] = [];
  let droppedExisting = 0;
  let droppedBatch = 0;
  for (const raw of sorted) {
    const nu = normalizeUrl(raw.url);
    // SNS 게시물은 제목이 비슷해도 서로 다른 게시물이므로 URL 로만 중복을 판단한다
    const sns = raw.source_type === 'instagram' || raw.source_type === 'youtube' || raw.source_type === 'community';
    if (sns ? seenUrl.has(nu) || kept.some((k) => normalizeUrl(k.raw.url) === nu) : false) {
      droppedExisting += seenUrl.has(nu) ? 1 : 0;
      if (!seenUrl.has(nu)) droppedBatch++;
      continue;
    }
    if (!sns && (seenUrl.has(nu) || existing.some((e) => titleSimilarity(e.title, raw.title) >= SIMILARITY || sameStory(e, raw)))) {
      droppedExisting++;
      continue;
    }
    const twin = sns ? undefined : kept.find((k) => normalizeUrl(k.raw.url) === nu || titleSimilarity(k.raw.title, raw.title) >= SIMILARITY || sameStory(k.raw, raw));
    if (twin) {
      twin.cluster++;
      if (raw.source_name !== twin.raw.source_name && !twin.also.some((a) => a.source_name === raw.source_name)) twin.also.push({ source_name: raw.source_name, url: raw.url });
      droppedBatch++;
      continue;
    }
    kept.push({ raw, cluster: 1, also: [] });
  }
  return { kept, droppedExisting, droppedBatch };
}

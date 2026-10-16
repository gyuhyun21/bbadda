import { test } from 'node:test';
import assert from 'node:assert/strict';
// site.ts 는 astro:content 를 불러와 테스트에서 직접 못 쓰므로 같은 규칙을 작은 함수로 검사한다
const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);
type S = { id: string; published_at: string; scores: { hot: number; relevance: number } };
const hot = (a: S, b: S) => b.scores.hot + b.scores.relevance * 0.5 - (a.scores.hot + a.scores.relevance * 0.5);
const byDayThenHot = (a: S, b: S) => kstDay(b.published_at).localeCompare(kstDay(a.published_at)) || hot(a, b);
test('헤드라인: 어제 고득점 기사보다 오늘 기사가 먼저', () => {
  const list: S[] = [
    { id: 'y1', published_at: '2026-10-16T03:00:00Z', scores: { hot: 95, relevance: 80 } },
    { id: 't1', published_at: '2026-10-16T22:00:00Z', scores: { hot: 40, relevance: 50 } }, // KST 10-17 07:00
    { id: 't2', published_at: '2026-10-17T00:30:00Z', scores: { hot: 60, relevance: 50 } },
  ];
  assert.deepEqual([...list].sort(byDayThenHot).map((s) => s.id), ['t2', 't1', 'y1']);
});

test('헤드라인: 이번 업데이트에 새로 들어온 기사가 이전 고득점 기사보다 먼저', () => {
  type C = S & { collected_at: string };
  const list: C[] = [
    { id: 'old', published_at: '2026-10-16T03:00:00Z', collected_at: '2026-10-16T12:00:00Z', scores: { hot: 95, relevance: 80 } },
    { id: 'new', published_at: '2026-10-16T11:00:00Z', collected_at: '2026-10-16T21:37:00Z', scores: { hot: 40, relevance: 50 } },
  ];
  const last = Math.max(...list.map((s) => Date.parse(s.collected_at)));
  const isNew = (s: C) => Date.parse(s.collected_at) >= last - 3 * 3600_000;
  assert.deepEqual([...list].sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || hot(a, b)).map((s) => s.id), ['new', 'old']);
});

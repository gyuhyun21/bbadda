import type { Signal } from '../../src/lib/schemas.ts';
import type { Cfg } from './classify.ts';
import { has, hasBaseballTerm } from './classify.ts';
import type { Cand } from './dedupe.ts';

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const log = (n: number) => Math.log10(1 + Math.max(0, n));

/** hot: 조회수·반응(영상) 또는 최신성·같은 소식 매체 수(뉴스). relevance: 팀 이름·로스터 선수·야구 일반어·리그 검색어. */
export function scoreAll(signals: Signal[], cands: Cand[], cfg: Cfg, now: Date): Signal[] {
  const cluster = new Map(cands.map((c) => [c.raw.url, c.cluster]));
  const via = new Map(cands.map((c) => [c.raw.url, c.raw.via]));
  const maxViews = Math.max(1, ...signals.map((s) => s.metrics.views ?? 0));
  const W = cfg.scoring;
  const players = new Map(cfg.teams.map((t) => [t.id, t.players]));
  return signals.map((s) => {
    const m = s.metrics;
    let hot: number;
    if (m.views !== undefined) {
      const eng = ((m.likes ?? 0) + (m.comments ?? 0)) / Math.max(1, m.views);
      hot = (log(m.views) / log(maxViews)) * 100 * (W.hot.views ?? 0) + clamp((eng / 0.05) * 100) * (W.hot.engagement ?? 0);
    } else {
      const ageDays = Math.max(0, (now.getTime() - Date.parse(s.published_at)) / 86400000);
      hot = clamp(100 * (1 - ageDays / 7)) * (W.hot.recency_news ?? 0) + clamp(((cluster.get(s.url) ?? 1) / 5) * 100) * (W.hot.cluster_news ?? 0);
    }
    const player = s.teams.some((t) => (players.get(t) ?? []).some((p) => has(s.title, p)));
    const relevance = (s.teams.length ? W.relevance.team ?? 0 : 0) + (player ? W.relevance.player ?? 0 : 0)
      + (hasBaseballTerm(s.title, cfg) ? W.relevance.baseball_term ?? 0 : 0) + (via.get(s.url) === 'league' ? W.relevance.league_query ?? 0 : 0);
    return { ...s, scores: { hot: Math.round(clamp(hot)), relevance: Math.round(clamp(relevance)) } };
  });
}

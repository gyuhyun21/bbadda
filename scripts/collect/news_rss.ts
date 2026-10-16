// 구글 뉴스 RSS — 팀별 검색어 × 한국어 로케일 + 리그 검색어. 제목·링크·날짜·매체명만(본문 저장 금지).
import { loadSources, loadTeams } from '../../src/lib/config.ts';
import { parseFeed, toIso, type Ctx, type RawItem } from './util.ts';

const q = (terms: string[]) => terms.map((t) => (/\s/.test(t) ? `"${t}"` : t)).join(' OR ');

export type FeedSpec = { id: string; url: string; via: RawItem['via'] };

export function buildFeeds(ctx?: Pick<Ctx, 'now' | 'realNow'>): FeedSpec[] {
  const cfg = loadSources().news_rss;
  let when = cfg.when;
  // 지난 호를 나중에 만들면 when:7d 는 '실제 오늘' 기준이라 그 주 앞부분이 빠진다 — 차이만큼 늘린다
  if (ctx?.realNow && ctx.realNow > ctx.now) when = `${Number(/^(\d+)d$/.exec(when)?.[1] ?? 7) + Math.ceil((ctx.realNow.getTime() - ctx.now.getTime()) / 86400000)}d`;
  const url = (query: string) => `https://news.google.com/rss/search?${new URLSearchParams({ q: `${query} when:${when}`, ...cfg.locale })}`;
  return [
    ...loadTeams().teams.map((t) => ({ id: `gnews-team-${t.id}`, url: url(q(t.news_queries)), via: 'team' as const })),
    ...cfg.league_queries.map((term) => ({ id: `gnews-league-${term}`, url: url(q([term])), via: 'league' as const })),
  ];
}

export async function collectNews(ctx: Ctx, specs = buildFeeds(ctx)) {
  const max = loadSources().news_rss.max_items_per_feed;
  const items: RawItem[] = [];
  const failures: { feed: string; error: string }[] = [];
  for (const spec of specs) {
    try {
      for (const e of parseFeed(await ctx.fetchText(spec.url)).slice(0, max)) {
        if (!e.title || !e.link) continue;
        items.push({ source_type: 'news', source_name: e.source || '(매체 미상)', url: e.link, title: e.title, published_at: toIso(e.date, ctx.now), via: spec.via });
      }
    } catch (e) {
      failures.push({ feed: spec.id, error: String((e as Error).message ?? e) });
    }
  }
  return { items, failures, feeds: specs.length };
}

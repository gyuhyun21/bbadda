// YouTube Data API v3 — 구단·KBO 공식 채널 최근 업로드 + 팀 이름 검색(팬 영상). 하루 무료 할당량 안에서 units_budget 으로 제한.
// 인증: YOUTUBE_API_KEY(로컬, 주소에 key=) 또는 YOUTUBE_AUTH=proxy(클라우드 시크릿이 www.googleapis.com 요청에 X-Goog-Api-Key 헤더 주입)
import { loadSources, loadTeams } from '../../src/lib/config.ts';
import type { Ctx, RawItem } from './util.ts';

const API = 'https://www.googleapis.com/youtube/v3';
export const COST = { search: 100, list: 1 } as const;

type Video = { id: string; snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } };

/** 채널 주소 → 조회 방법. /channel/UC… 는 id, /@핸들 · /c/이름 은 forHandle, /user/이름 은 forUsername */
export function channelRef(url: string): { id?: string; forHandle?: string; forUsername?: string } | null {
  const m = /youtube\.com\/(channel\/(UC[\w-]{22})|@([\w.-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i.exec(url);
  if (!m) return null;
  if (m[2]) return { id: m[2] };
  if (m[3] || m[4]) return { forHandle: `@${m[3] ?? m[4]}` };
  return { forUsername: m[5] };
}

export function videoToItem(v: Video, via: RawItem['via'], team_hint?: string): RawItem {
  const s = v.statistics ?? {};
  return {
    source_type: 'youtube', source_name: v.snippet.channelTitle, url: `https://www.youtube.com/watch?v=${v.id}`, title: v.snippet.title,
    published_at: v.snippet.publishedAt, via, ...(team_hint ? { team_hint, official: true } : {}),
    metrics: { views: Number(s.viewCount ?? 0), likes: Number(s.likeCount ?? 0), comments: Number(s.commentCount ?? 0) },
  };
}

export type YouTubeResult = { items: RawItem[]; units: number; skipped?: string; searches: number; failures: string[]; filtered_by_title?: number };

export async function collectYouTube(ctx: Ctx, override?: Record<string, any>): Promise<YouTubeResult> {
  const key = ctx.env.YOUTUBE_API_KEY;
  const proxy = ctx.env.YOUTUBE_AUTH === 'proxy';
  const res: YouTubeResult = { items: [], units: 0, searches: 0, failures: [] };
  const cfg = override ?? loadSources().youtube;
  if (!cfg.enabled) return { ...res, skipped: 'disabled' };
  if (!key && !proxy) return { ...res, skipped: 'YOUTUBE_API_KEY 없음 (또는 YOUTUBE_AUTH=proxy 필요)' };
  const budget = Number(cfg.units_budget ?? 3000);
  const after = new Date(ctx.now.getTime() - Number(cfg.lookback_days ?? 3) * 86400000).toISOString();
  const get = async (path: string, params: Record<string, string>, cost: number) => {
    if (res.units + cost > budget) throw new Error(`units 예산(${budget}) 초과 방지로 중단`);
    res.units += cost;
    return JSON.parse(await ctx.fetchText(`${API}/${path}?${new URLSearchParams(key && !proxy ? { ...params, key } : params)}`));
  };
  const teams = loadTeams();
  const meta = new Map<string, { via: RawItem['via']; team_hint?: string }>();

  // 1) 공식 채널(구단·KBO) 최근 업로드
  const channels = [...teams.teams.map((t) => ({ hint: t.id, url: t.youtube })), { hint: 'kbo', url: teams.league.youtube }].filter((c) => c.url);
  for (const ch of channels) {
    try {
      const ref = channelRef(ch.url!);
      if (!ref) { res.failures.push(`channel ${ch.url}: 주소 형식을 모름`); continue; }
      const id = ref.id ?? (await get('channels', { part: 'id', ...(ref.forHandle ? { forHandle: ref.forHandle } : { forUsername: ref.forUsername! }) }, COST.list)).items?.[0]?.id;
      if (!id) { res.failures.push(`channel ${ch.url}: 채널을 찾지 못함`); continue; }
      const data = await get('playlistItems', { part: 'contentDetails', playlistId: 'UU' + id.slice(2), maxResults: '15' }, COST.list);
      for (const it of data.items ?? []) {
        const vid = it.contentDetails?.videoId;
        if (vid && Date.parse(it.contentDetails?.videoPublishedAt ?? '') >= Date.parse(after)) meta.set(vid, { via: ch.hint === 'kbo' ? 'league' : 'team', team_hint: ch.hint });
      }
    } catch (e) { res.failures.push(`channel ${ch.url}: ${(e as Error).message}`); }
  }
  // 2) 팀 이름 검색 — 공식 채널이 아닌 영상은 팬 반응
  if (cfg.team_search) {
    for (const t of teams.teams) {
      try {
        const data = await get('search', { part: 'snippet', type: 'video', q: t.name, order: 'date', publishedAfter: after, relevanceLanguage: 'ko', regionCode: 'KR', maxResults: String(cfg.max_results_per_query ?? 10), ...(ctx.realNow && ctx.realNow > ctx.now ? { publishedBefore: ctx.now.toISOString() } : {}) }, COST.search);
        res.searches++;
        for (const it of data.items ?? []) if (it.id?.videoId && !meta.has(it.id.videoId)) meta.set(it.id.videoId, { via: 'fans' });
      } catch (e) { res.failures.push(`search ${t.name}: ${(e as Error).message}`); }
    }
  }
  const skip = ((cfg.exclude_title_patterns ?? []) as string[]).map((p) => new RegExp(p, 'i'));
  // 3) 영상 상세(조회수)
  const ids = [...meta.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const data = await get('videos', { part: 'snippet,statistics', id: ids.slice(i, i + 50).join(',') }, COST.list);
      for (const v of (data.items ?? []) as Video[]) {
        const m = meta.get(v.id)!;
        // 공식 채널 영상은 그대로 두고, 검색으로 들어온 영상만 제목 패턴으로 거른다
        if (!m.team_hint && skip.some((re) => re.test(v.snippet.title))) { res.filtered_by_title = (res.filtered_by_title ?? 0) + 1; continue; }
        res.items.push(videoToItem(v, m.via, m.team_hint));
      }
    } catch (e) { res.failures.push(`videos: ${(e as Error).message}`); }
  }
  ctx.log(`youtube: 검색 ${res.searches}회, units ${res.units}/${budget}`);
  return res;
}

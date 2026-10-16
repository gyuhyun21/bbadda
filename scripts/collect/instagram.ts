// Instagram Business Discovery — 구단·KBO 공식 계정(비즈니스 계정만 조회된다)의 최근 게시물. 캡션은 앞 12단어만 제목에 쓰고 본문·사진은 저장하지 않는다.
// 토큰: 60일 장기 토큰, 권한 instagram_basic·instagram_manage_insights·pages_show_list·pages_read_engagement·business_management. 오류 190 = 만료.
// 인증: INSTAGRAM_TOKEN(로컬) 또는 INSTAGRAM_AUTH=proxy(클라우드 시크릿이 graph.facebook.com 에 'Authorization: Bearer <토큰>' 주입) + INSTAGRAM_USER_ID
import { loadSources, loadTeams } from '../../src/lib/config.ts';
import type { Ctx, RawItem } from './util.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_TITLE_WORDS = 12;

export const usernameOf = (url: string) => /instagram\.com\/([\w.]+)\/?/i.exec(url)?.[1];
/** 캡션 첫 줄에서 해시태그·멘션을 빼고 앞 12단어까지만 */
export function captionSnippet(caption?: string): string {
  const first = (caption ?? '').split('\n').map((l) => l.trim()).find((l) => l.replace(/[#@]\S+/g, '').trim()) ?? '';
  const words = first.replace(/[#@]\S+/g, '').split(/\s+/).filter(Boolean);
  return words.slice(0, MAX_TITLE_WORDS).join(' ') + (words.length > MAX_TITLE_WORDS ? '…' : '');
}
type Media = { caption?: string; permalink: string; timestamp: string; like_count?: number; comments_count?: number; media_type?: string };

export function mediaToItem(name: string, username: string, hint: string, m: Media): RawItem {
  const snip = captionSnippet(m.caption);
  const kind = m.media_type === 'VIDEO' ? '영상' : m.media_type === 'CAROUSEL_ALBUM' ? '슬라이드' : '사진';
  return {
    source_type: 'instagram', source_name: `Instagram @${username}`, url: m.permalink,
    title: snip ? `${name} 공식 인스타그램: ${snip}` : `${name} 공식 인스타그램 ${kind} (${m.timestamp.slice(0, 10)})`,
    published_at: m.timestamp, via: hint === 'kbo' ? 'league' : 'team', team_hint: hint, official: true,
    metrics: { likes: m.like_count, comments: m.comments_count },
  };
}

export function isTokenExpired(message: string) { return /"code":\s*190|OAuthException.*190|code 190/i.test(message); }

export async function collectInstagram(ctx: Ctx, override?: Record<string, any>) {
  const cfg = override ?? loadSources().instagram;
  const proxy = ctx.env.INSTAGRAM_AUTH === 'proxy';
  const token = ctx.env.INSTAGRAM_TOKEN;
  const uid = ctx.env.INSTAGRAM_USER_ID;
  const out = { items: [] as RawItem[], failures: [] as string[] };
  if (!cfg.enabled) return { ...out, skipped: 'disabled' };
  if ((!token && !proxy) || !uid) return { ...out, skipped: 'INSTAGRAM_USER_ID 와 INSTAGRAM_TOKEN(또는 INSTAGRAM_AUTH=proxy) 필요' };
  const auth = (q: Record<string, string>) => new URLSearchParams(proxy ? q : { ...q, access_token: token! });
  const t = loadTeams();
  const accounts = [...t.teams.map((x) => ({ name: x.name, hint: x.id, url: x.instagram })), { name: t.league.name, hint: 'kbo', url: t.league.instagram }].filter((a) => a.url);
  for (const a of accounts) {
    const username = usernameOf(a.url!);
    if (!username) continue;
    try {
      const fields = `business_discovery.username(${username}){media.limit(${Number(cfg.media_per_account ?? 8)}){caption,permalink,timestamp,like_count,comments_count,media_type}}`;
      const r = JSON.parse(await ctx.fetchText(`${GRAPH}/${uid}?${auth({ fields })}`));
      for (const m of r.business_discovery?.media?.data ?? []) if (m.permalink && m.timestamp) out.items.push(mediaToItem(a.name, username, a.hint, m));
    } catch (e) {
      const msg = (e as Error).message;
      out.failures.push(`@${username}: ${isTokenExpired(msg) ? '토큰 만료(오류 190) — 장기 토큰을 다시 발급하세요' : msg}`);
      if (isTokenExpired(msg)) break;
    }
  }
  return out;
}

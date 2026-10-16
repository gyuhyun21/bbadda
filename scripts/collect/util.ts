import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import type { Signal } from '../../src/lib/schemas.ts';

export type RawItem = {
  source_type: Signal['source_type'];
  source_name: string;
  url: string;
  title: string;
  published_at: string;
  // 출처 자체가 특정 팀(구단 공식 채널)이면 그 팀 id. 'kbo' 는 KBO 공식 채널
  team_hint?: string;
  official?: boolean;
  // 어떤 검색으로 들어왔는지: 팀 검색 / 리그 검색 / 팬 반응(커뮤니티·영상 검색)
  via: 'team' | 'league' | 'fans';
  // 어느 팀 검색어로 들어왔는지(제목에 팀 이름이 없을 때 쓴다)
  query_teams?: string[];
  metrics?: Signal['metrics'];
  excerpt?: string;        // 검색 결과 발췌(15단어 이내)
  slang?: string;
  lookback_days?: number;  // 수집 기간 시작보다 이 일수만큼 이른 글도 받는다(색인이 늦는 커뮤니티 검색). 저장하지 않는다
};

export type FetchOpts = { method?: 'GET' | 'POST'; body?: string; headers?: Record<string, string> };

export type Ctx = {
  now: Date;
  fetchText: (url: string, opts?: FetchOpts) => Promise<string>;
  log: (msg: string) => void;
  env: Record<string, string | undefined>;
  readManual?: (week: string) => string | null;
  // 지정하면 이 소스 유형만 수집한다(예: ['instagram']). 지운 signal 을 되살리지 않고 한 소스만 보탤 때 쓴다.
  only?: string[];
  // 지난 호를 나중에 만들 때(--as-of): now 는 그 호의 정기 실행 시각, realNow 는 실제 실행 시각. 상대 기간 검색(뉴스 when:7d)을 늘리는 데 쓴다.
  realNow?: Date;
};

const TRACKING = /^(utm_|fbclid|gclid|igshid|ref$|ref_src|cmpid|mc_)/i;

export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k);
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    let s = url.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return u.trim();
  }
}

export const hash8 = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 8);
export const signalId = (type: string, url: string) => `${type}-${hash8(normalizeUrl(url))}`;

/** 제목 정규화 + 문자 bigram Dice 유사도 (한/중/일 공백 없는 문자열에도 동작) */
export const normTitle = (t: string) => t.toLowerCase().replace(/\s[-–|]\s[^-–|]+$/, '').replace(/[^\p{L}\p{N}]+/gu, '');
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
  return m;
}
export function titleSimilarity(a: string, b: string): number {
  const x = normTitle(a);
  const y = normTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x);
  const B = bigrams(y);
  let inter = 0;
  for (const [k, v] of A) inter += Math.min(v, B.get(k) ?? 0);
  return (2 * inter) / (Math.max(x.length - 1, 0) + Math.max(y.length - 1, 0) || 1);
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', processEntities: true });
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'object' && v && '#text' in v ? String((v as Record<string, unknown>)['#text']) : v == null ? '' : String(v));

export type FeedEntry = { title: string; link: string; date: string; source?: string };

/** RSS 2.0 / Atom 공통 파서. 제목·링크·날짜·매체명만 추출한다 (본문 저장 금지). */
export function parseFeed(body: string): FeedEntry[] {
  const doc = xml.parse(body);
  if (doc?.rss?.channel) {
    return arr(doc.rss.channel.item).map((it: Record<string, unknown>) => ({
      title: text(it.title).trim(),
      link: text(it.link).trim(),
      date: text(it.pubDate) || text(it['dc:date']),
      source: it.source ? text(it.source) : undefined,
    }));
  }
  if (doc?.feed) {
    return arr(doc.feed.entry).map((e: Record<string, unknown>) => {
      const links = arr(e.link as Record<string, string> | Record<string, string>[]);
      const href = (links.find((l) => l['@_rel'] === 'alternate') ?? links[0])?.['@_href'] ?? '';
      return { title: text(e.title).trim(), link: href, date: text(e.published) || text(e.updated) };
    });
  }
  return [];
}


export function toIso(d: string, fallback: Date): string {
  const t = Date.parse(d);
  return Number.isNaN(t) ? fallback.toISOString() : new Date(t).toISOString();
}

export const inWindow = (iso: string, start: Date, end: Date) => {
  const t = Date.parse(iso);
  return t >= start.getTime() && t <= end.getTime();
};

export const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
/** 15단어 이내 발췌(편집자가 요약을 쓸 때 참고). 본문은 저장하지 않는다. */
export function excerpt(s: string | undefined, max = 15): string | undefined {
  const words = stripTags(s ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return undefined;
  return words.slice(0, max).join(' ') + (words.length > max ? '…' : '');
}

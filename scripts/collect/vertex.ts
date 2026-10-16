// 구글 Vertex AI Search(웹사이트 검색) — 커뮤니티의 팀 언급 글을 구글 색인으로 찾는다. 사이트에는 접속하지 않고 제목·링크·날짜·15단어 발췌만 쓴다.
// 데이터 저장소에 대상 사이트를 등록하고 searchLite(API 키)로 호출. 계정당 매달 10,000회 무료, 한 번 실행에 max_queries 회까지만.
// 인증: VERTEX_AUTH=proxy(클라우드 시크릿이 discoveryengine.googleapis.com 에 X-Goog-Api-Key 헤더 주입) 또는 VERTEX_API_KEY(로컬)
// 엔진: VERTEX_ENGINE=projects/<번호>/locations/global/collections/default_collection/engines/<앱 ID>
import { loadSources, loadTeams } from '../../src/lib/config.ts';
import { excerpt, stripTags, type Ctx, type RawItem } from './util.ts';

const API = 'https://discoveryengine.googleapis.com/v1';
type Site = { host: string; path?: string; name: string; lang?: string };
type Query = { q: string; site: Site; team?: string };
type Result = { document?: { derivedStructData?: { title?: string; link?: string; snippets?: { snippet?: string }[]; pagemap?: { metatags?: Record<string, string>[] } } } };

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\.|^m\./, ''); } catch { return ''; } };
const SUSPECT_SAME_DATE = 3;
/** 시각 없이 날짜만 있는 값: 한국 자정(15:00Z) 또는 UTC 자정 */
export const isDateOnly = (iso: string) => /T(15|00):00:00(\.000)?Z$/.test(iso);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 제목 끝의 사이트 꼬리표(' - MLBPARK', ' : 디시인사이드' 등)를 뗀다 */
export const cleanTitle = (t: string) => stripTags(t).replace(/\s*[-:|·]\s*(MLBPARK|엠엘비파크|디시인사이드|dcinside|.*갤러리|더쿠|theqoo|에펨코리아|FM코리아|fmkorea|reddit|r\/\w+).*$/i, '').trim();

/** 링크 정리: 레딧 ?tl=ko 같은 표시 쿼리·해시, 겹친 &amp;, 빈 파라미터를 뗀다. 글 번호 쿼리(?no=, ?id=)는 남긴다. */
export function normalizeLink(u: string): string {
  try {
    let raw = u;
    while (/&amp;/i.test(raw)) raw = raw.replace(/&amp;/gi, '&');
    const x = new URL(raw);
    x.hash = '';
    for (const [k, v] of [...x.searchParams]) if (v === '') x.searchParams.delete(k);
    if (/(^|\.)reddit\.com$/i.test(x.hostname)) { x.search = ''; x.hostname = 'www.reddit.com'; }
    else if (/(^|\.)theqoo\.net$/i.test(x.hostname) && /\/\d+$/.test(x.pathname)) x.search = '';
    else x.searchParams.delete('tl');
    return x.toString();
  } catch { return u; }
}

/** 게시 날짜: 메타태그(작성 시각만) → 발췌의 날짜('2026. 10. 14.', 'Oct 14, 2026') → 상대 시간('3일 전', '3 days ago'). 못 찾으면 undefined. */
export function findDate(meta: Record<string, string> | undefined, snippet: string | undefined, now: Date): string | undefined {
  return findDateWithSource(meta, snippet, now)?.iso;
}

/** 날짜와 그 출처(meta: 페이지 메타태그, text: 발췌의 날짜·상대 시간). 의심 날짜 규칙은 meta 에만 적용한다. */
export function findDateWithSource(meta: Record<string, string> | undefined, snippet: string | undefined, now: Date): { iso: string; from: 'meta' | 'text' } | undefined {
  // 수정 시각(article:modified_time·og:updated_time)은 쓰지 않는다 — 옛 글이 이번 주 글처럼 보인다
  for (const k of ['article:published_time', 'og:article:published_time', 'date', 'pubdate', 'datepublished']) {
    const v = meta?.[k];
    if (v && Number.isFinite(Date.parse(v))) return { iso: new Date(v).toISOString(), from: 'meta' };
  }
  const s = stripTags(snippet ?? '');
  const ymd = /(20\d\d)[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/.exec(s);
  if (ymd) return { iso: new Date(`${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}T00:00:00+09:00`).toISOString(), from: 'text' };
  const en = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)\b/i.exec(s);
  if (en) return { iso: new Date(`${en[3]}-${String(MONTHS.indexOf(en[1].toLowerCase()) + 1).padStart(2, '0')}-${en[2].padStart(2, '0')}T00:00:00Z`).toISOString(), from: 'text' };
  const rel = /(\d+)\s*(일|시간|분)\s*전|(\d+)\s*(day|hour|minute)s?\s+ago/i.exec(s);
  if (rel) {
    const n = Number(rel[1] ?? rel[3]);
    const unit = (rel[2] ?? rel[4]).toLowerCase();
    // 'N일 전'은 그날 한국 날짜(자정)로 — 실행 시각을 붙이면 없는 시각을 지어내게 된다(2026-10-17 실측)
    if (unit === '일' || unit === 'day') return { iso: new Date(`${new Date(now.getTime() + 9 * 3600000 - n * 86400000).toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString(), from: 'text' };
    return { iso: new Date(now.getTime() - n * (unit === '시간' || unit === 'hour' ? 3600000 : 60000)).toISOString(), from: 'text' };
  }
  return undefined;
}

/** 사이트 × 팀 쿼리. 레딧처럼 영어 사이트는 팀 영어 이름으로. */
export function buildQueries(sites: Site[]): Query[] {
  const teams = loadTeams().teams;
  return sites.flatMap((site) => teams.map((t) => ({ site, team: t.id, q: site.lang === 'en' ? t.aliases.find((a) => /^[\x00-\x7F]+$/.test(a)) ?? t.name : t.name })));
}

export async function collectVertex(ctx: Ctx, override?: Record<string, any>) {
  const cfg = override ?? loadSources().vertex;
  const out = { items: [] as RawItem[], failures: [] as string[], requests: 0, dropped_undated: 0, dropped_suspect_date: 0 };
  if (!cfg.enabled) return { ...out, skipped: 'disabled' };
  const proxy = ctx.env.VERTEX_AUTH === 'proxy';
  const key = ctx.env.VERTEX_API_KEY;
  const engine = ctx.env.VERTEX_ENGINE?.replace(/^\/+|\/+$/g, '');
  if (!proxy && !key) return { ...out, skipped: 'VERTEX_AUTH=proxy (또는 VERTEX_API_KEY) 필요' };
  if (!engine || !/^projects\/[^/]+\/locations\/[^/]+\/collections\/[^/]+\/engines\/[^/]+$/.test(engine)) return { ...out, skipped: 'VERTEX_ENGINE(projects/…/engines/<앱 ID>) 필요' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(proxy ? {} : { 'X-Goog-Api-Key': key! }) };
  const url = `${API}/${engine}/servingConfigs/default_search:searchLite`;
  const sites = (cfg.sites ?? []) as Site[];
  const slang = ((cfg.slang ?? []) as { pattern: string; term: string }[]).map((s) => ({ re: new RegExp(s.pattern, 'i'), term: s.term }));
  const seen = new Set<string>();
  const metaDated = new Set<string>(); // 메타태그에서 날짜를 읽은 글
  for (const { q, site, team } of ((cfg.queries as Query[] | undefined) ?? buildQueries(sites)).slice(0, Number(cfg.max_queries ?? 60))) {
    try {
      out.requests++;
      const body: Record<string, unknown> = {
        servingConfig: `${engine}/servingConfigs/default_search`, query: q, pageSize: Math.min(25, Number(cfg.page_size ?? 10)), safeSearch: true,
        ...(cfg.order_by ? { orderBy: cfg.order_by } : {}),
        // 쿼리마다 사이트 한 곳 — 한 사이트가 결과를 독차지하지 않게
        filter: `siteSearch:"https://${site.host}${site.path ?? ''}/*"`,
      };
      const data = JSON.parse(await ctx.fetchText(url, { method: 'POST', body: JSON.stringify(body), headers })) as { results?: Result[] };
      for (const r of data.results ?? []) {
        const d = r.document?.derivedStructData;
        const link = d?.link ? normalizeLink(d.link) : undefined;
        if (!link || !d?.title || seen.has(link)) continue;
        const host = hostOf(link);
        if (!(host === site.host || host.endsWith('.' + site.host))) continue;
        const snippet = (d.snippets ?? []).map((s) => s.snippet ?? '').join(' ');
        const found = findDateWithSource(d.pagemap?.metatags?.[0], snippet, ctx.now);
        if (!found) { out.dropped_undated++; continue; }
        const date = found.iso;
        if (found.from === 'meta') metaDated.add(link);
        seen.add(link);
        const title = cleanTitle(d.title);
        const ex = excerpt(snippet.replace(/^\s*(20\d\d[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}\.?|\d+\s*(일|시간|분)\s*전|\d+\s*(day|hour|minute)s?\s+ago|[A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+20\d\d)\s*[—–-]?\s*/i, ''));
        const sl = slang.find((s) => s.re.test(title))?.term;
        out.items.push({
          source_type: 'community', source_name: site.name, url: link, title, published_at: date, via: 'fans', ...(team ? { query_teams: [team] } : {}),
          ...(ex ? { excerpt: ex } : {}), ...(sl ? { slang: sl } : {}), ...(cfg.lookback_days ? { lookback_days: Number(cfg.lookback_days) } : {}),
        });
      }
    } catch (e) {
      out.failures.push(`${site.name} "${q}": ${(e as Error).message}`);
    }
  }
  // 같은 사이트 글 3건 이상이 시각까지 똑같으면 작성일이 아니라 색인 시각으로 보고 버린다.
  // 날짜만 있는 글(시각 없음)은 같은 날 글이 여러 개인 게 정상이라 이 규칙에서 뺀다(2026-10-17 실측: 정상 글 309건이 잘림)
  const n = new Map<string, number>();
  // 메타태그 날짜만 센다 — 발췌의 날짜·상대 시간은 색인 시각이 아니다
  const suspectable = (it: RawItem) => metaDated.has(it.url) && !isDateOnly(it.published_at);
  for (const it of out.items) if (suspectable(it)) n.set(`${it.source_name}|${it.published_at}`, (n.get(`${it.source_name}|${it.published_at}`) ?? 0) + 1);
  const keep = out.items.filter((it) => !suspectable(it) || (n.get(`${it.source_name}|${it.published_at}`) ?? 0) < SUSPECT_SAME_DATE);
  out.dropped_suspect_date = out.items.length - keep.length;
  out.items = keep;
  return out;
}

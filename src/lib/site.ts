// 사이트 공통 데이터 로더 · 라벨 · 헬퍼 (Astro 빌드 시점에 실행).
import { getCollection, type CollectionEntry } from 'astro:content';
import { loadTeams, type Team } from './config.ts';
import type { Signal } from './schemas.ts';

export const SHOW_DRAFT = process.env.SHOW_DRAFT === '1';
export const SITE_NAME = 'BBADDA';

export const MODULE_LABEL = { team: '팀 소식', fans: '팬 반응', rivalry: '라이벌·순위 경쟁', league: '리그 전체' } as const;
export const SOURCE_LABEL = { news: '뉴스', youtube: 'YouTube', instagram: 'Instagram', community: '커뮤니티' } as const;
export const SENTIMENT_LABEL = { positive: '긍정', neutral: '중립', negative: '부정', mixed: '혼재' } as const;
export const SLANG_TITLE = '수집된 글에 쓰인 팬 은어';
// 팀 컬러 출처를 확인하기 전까지 쓰는 중립색
export const NEUTRAL_TEAM_COLOR = '#8E8E93';

const cfg = loadTeams();
export const TEAMS: Team[] = cfg.teams;
export const LEAGUE = cfg.league;
export const teamById = new Map(TEAMS.map((t) => [t.id, t]));
export const teamColor = (id?: string) => (id && teamById.get(id)?.color) || NEUTRAL_TEAM_COLOR;
export const teamName = (id?: string) => (id ? teamById.get(id)?.name ?? id : 'KBO');
export const teamShort = (id?: string) => (id ? teamById.get(id)?.short ?? id : 'KBO');

export type ColumnEntry = CollectionEntry<'columns'>;
export type SiteData = { signals: Signal[]; byId: Map<string, Signal>; columns: ColumnEntry[] };

/** 화면에 내보내는 신호: 요약을 쓴(편집을 거친) 것만. 수집만 되고 선별 전인 글은 보이지 않는다. */
export const isReady = (s: Signal) => s.summary_ko.trim() !== '';

let cache: Promise<SiteData> | null = null;
export function loadAll(): Promise<SiteData> {
  cache ??= (async () => {
    const all = (await getCollection('signals')).map((e) => e.data);
    const signals = all.filter(isReady);
    const columns = (await getCollection('columns')).filter((e) => SHOW_DRAFT || e.data.status === 'published').sort((a, b) => b.data.published_at.localeCompare(a.data.published_at));
    return { signals, byId: new Map(all.map((s) => [s.id, s])), columns };
  })();
  return cache;
}

export const ofTeam = (list: Signal[], id: string) => list.filter((s) => s.teams.includes(id));
/** 커뮤니티 사이트 글(엠엘비파크·디시·더쿠·에펨·레딧 — Vertex 검색). 다음 블로그·카페는 팬 반응으로 둔다. */
export const isCommunityPost = (s: Pick<Signal, 'source_type' | 'source_name'>) => s.source_type === 'community' && !/^(블로그|다음카페)(\s|$)/.test(s.source_name);
/** 커뮤니티 사이트 배지(짧은 이름 + 색). 사이트 로고는 쓰지 않는다. */
export const COMMUNITY_BADGE: Record<string, { label: string; color: string }> = {
  엠엘비파크: { label: '엠팍', color: '#1F5FA8' },
  '디시 야구 갤러리': { label: '디시', color: '#3B4890' },
  더쿠: { label: '더쿠', color: '#6E56CF' },
  에펨코리아: { label: '펨코', color: '#2F7D4F' },
  '레딧 r/KBO': { label: '레딧', color: '#D9480F' },
};
export const communityBadge = (name: string) => COMMUNITY_BADGE[name] ?? { label: name.slice(0, 2), color: '#6E6E73' };
/** 팬 반응 글의 출처 배지: 블로그·카페 */
export const fanSourceLabel = (name: string) => (/^다음카페/.test(name) ? '카페' : /^블로그/.test(name) ? '블로그' : '글');

export const hot = (a: Signal, b: Signal) => b.scores.hot + b.scores.relevance * 0.5 - (a.scores.hot + a.scores.relevance * 0.5);
export const newest = (a: Signal, b: Signal) => Date.parse(b.published_at) - Date.parse(a.published_at);

/** 빌드 시각 기준 최근 n일 신호(최신순). 없으면 가장 최근 것 몇 개. 매일 아침 빌드되므로 '오늘'은 빌드 날짜다. */
export function recent(list: Signal[], days = 7, fallback = 6): Signal[] {
  const since = BUILD_TIME - days * 86400_000;
  const r = list.filter((s) => Date.parse(s.published_at) >= since).sort(newest);
  return r.length ? r : [...list].sort(newest).slice(0, fallback);
}
export const BUILD_TIME = Date.now();
export const isToday = (s: Signal) => BUILD_TIME - Date.parse(s.published_at) < 86400_000;

export const fmtDate = (iso: string) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10).replaceAll('-', '.');
};
export const fmtNum = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : n.toLocaleString('ko-KR'));
export const stripSample = (t: string) => t.replace(/^\[SAMPLE\]\s*/, '');
/** 카드 제목: 한국어 제목이 있으면 그것, 없으면 원제 */
export const displayTitle = (s: Signal) => stripSample(s.title_ko || s.title);
export const shortTitle = (t: string, n = 38) => (stripSample(t).length > n ? stripSample(t).slice(0, n) + '…' : stripSample(t));
export const youtubeId = (url: string) => /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/.exec(url)?.[1];

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (t: string) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
/** 에디토리얼용 작은 서식: 줄바꿈으로 문단, '- ' 줄은 목록, **굵게**, *기울임*. HTML 은 이스케이프. */
export function rich(text: string): string {
  const out: string[] = [];
  let items: string[] = [];
  const flush = () => { if (items.length) out.push(`<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`); items = []; };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('- ')) items.push(inline(line.slice(2)));
    else { flush(); out.push(`<p>${inline(line)}</p>`); }
  }
  flush();
  return out.join('');
}
/** 에디토리얼 첫 줄(요지)만 — 접힌 팀 섹션 머리에 쓴다 */
export const firstLine = (text?: string) => (text ?? '').split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('- '))?.replace(/\*+/g, '') ?? '';

// 타이포 커버 줄바꿈 (한글·한자 폭 2, 그 외 1)
const w = (ch: string) => (/[ᄀ-ᇿ　-鿿가-힣＀-￯]/.test(ch) ? 2 : 1);
export function wrapTitle(title: string, maxUnits = 22, maxLines = 4): string[] {
  const lines: string[] = [];
  let cur = '';
  let width = 0;
  const push = () => { if (cur.trim()) lines.push(cur.trim()); cur = ''; width = 0; };
  for (const word of title.split(/\s+/)) {
    const ww = [...word].reduce((a, c) => a + w(c), 0);
    if (width + ww + (cur ? 1 : 0) <= maxUnits) { cur += (cur ? ' ' : '') + word; width += ww + (cur === word ? 0 : 1); continue; }
    push();
    if (ww <= maxUnits) { cur = word; width = ww; continue; }
    for (const ch of word) { if (width + w(ch) > maxUnits) push(); cur += ch; width += w(ch); }
  }
  push();
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.?$/, '…'); }
  return lines;
}

// ── 날짜 기준(매일 갱신). 날짜는 기사 게시일의 한국 날짜.
/** ISO 시각 → 한국 날짜 'YYYY-MM-DD' */
export const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
/** '2026-10-16' → '10월 16일 (금)' */
export const dayLabel = (d: string) => { const [, m, dd] = d.split('-').map(Number); return `${m}월 ${dd}일 (${WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()]})`; };
/** 요약이 있는 소식이 있는 날짜들(최신순) */
export const daysOf = (list: Signal[]) => [...new Set(list.map((s) => kstDay(s.published_at)))].sort().reverse();
export const onDay = (list: Signal[], d: string) => list.filter((s) => kstDay(s.published_at) === d);
/** 리그 블록 제목: 10~11월 가을야구, 12~2월 스토브리그, 3월 시범경기·개막, 그 밖에는 리그 전체 */
export function seasonTitle(d = new Date(BUILD_TIME)): string {
  const m = new Date(d.getTime() + 9 * 3600_000).getUTCMonth() + 1;
  return m === 10 || m === 11 ? '가을야구' : m === 12 || m <= 2 ? '스토브리그' : m === 3 ? '개막 준비' : '리그 전체';
}

/** 날짜 최신순 → 같은 날 안에서 점수순. 점수(최신성 포함)는 수집 때 고정되므로 날짜를 먼저 본다(2026-10-18). */
export const byDayThenHot = (a: Signal, b: Signal) => kstDay(b.published_at).localeCompare(kstDay(a.published_at)) || hot(a, b);
/** 가장 최근 업데이트(마지막 수집 시각에서 3시간 안 = 같은 루틴 실행)에 새로 들어온 글인지 — 아침 루틴은 대개 전날 저녁 기사를 가져오므로 게시일이 아니라 수집 시각으로 본다(2026-10-17) */
export function latestBatch(list: Signal[]): (s: Signal) => boolean {
  const last = Math.max(0, ...list.map((s) => Date.parse(s.collected_at)).filter(Number.isFinite));
  return (s) => Date.parse(s.collected_at) >= last - 3 * 3600_000;
}
/** 새로 들어온 글 먼저 → 날짜 최신순 → 점수순 */
export function newFirst(list: Signal[]): Signal[] {
  const isNew = latestBatch(list);
  return [...list].sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || byDayThenHot(a, b));
}

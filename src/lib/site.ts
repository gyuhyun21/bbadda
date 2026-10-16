// 사이트 공통 데이터 로더 · 라벨 · 헬퍼 (Astro 빌드 시점에 실행).
import { getCollection, type CollectionEntry } from 'astro:content';
import { loadTeams, type Team } from './config.ts';
import type { Signal, Issue } from './schemas.ts';

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
export type SiteData = { signals: Signal[]; byId: Map<string, Signal>; issues: Issue[]; columns: ColumnEntry[] };

/** 화면에 내보내는 신호: 요약을 쓴(편집을 거친) 것만. 수집만 되고 선별 전인 글은 보이지 않는다. */
export const isReady = (s: Signal) => s.summary_ko.trim() !== '';

let cache: Promise<SiteData> | null = null;
export function loadAll(): Promise<SiteData> {
  cache ??= (async () => {
    const all = (await getCollection('signals')).map((e) => e.data);
    const signals = all.filter(isReady);
    const issues = (await getCollection('issues')).map((e) => e.data).filter((i) => SHOW_DRAFT || i.status === 'published').sort((a, b) => b.vol.localeCompare(a.vol));
    const columns = (await getCollection('columns')).filter((e) => SHOW_DRAFT || e.data.status === 'published').sort((a, b) => b.data.published_at.localeCompare(a.data.published_at));
    return { signals, byId: new Map(all.map((s) => [s.id, s])), issues, columns };
  })();
  return cache;
}

export const issueSignals = (d: SiteData, vol: string) => d.signals.filter((s) => s.issue === vol);
export const ofTeam = (list: Signal[], id: string) => list.filter((s) => s.teams.includes(id));
export const isCommunityPost = (s: Pick<Signal, 'source_type'>) => s.source_type === 'community';

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
/** 회차 이름: '2026-W43' → '2026년 43주차' */
export const issueLabel = (vol: string) => { const [y, w] = vol.split('-W'); return `${y}년 ${Number(w)}주차`; };
/** 기간: '10월 12일 ~ 10월 18일' (연도가 다르면 연도도) */
export function periodLabel(start: string, end: string) {
  const [ys, ms, ds] = start.slice(0, 10).split('-').map(Number);
  const [ye, me, de] = end.slice(0, 10).split('-').map(Number);
  return `${ys !== ye ? `${ys}년 ` : ''}${ms}월 ${ds}일 ~ ${ys !== ye ? `${ye}년 ` : ''}${me}월 ${de}일`;
}
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

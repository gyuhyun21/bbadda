import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';

export const ROOT = process.cwd();
const url = z.string().url().nullable().default(null);

const teamSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  name: z.string(),
  short: z.string(),
  nickname: z.string().optional(),
  city: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
  website: url,
  youtube: url,
  instagram: url,
  news_queries: z.array(z.string()).min(1),
  aliases: z.array(z.string()).min(1),
  weak_aliases: z.array(z.string()).default([]),
  exclude_any: z.array(z.string()).default([]),
  // 확인된 로스터 선수 이름(관련도 점수용). 출처 URL을 주석으로 남긴 것만.
  players: z.array(z.string()).default([]),
});
const teamsSchema = z.object({
  teams: z.array(teamSchema).length(10),
  league: z.object({ name: z.string(), website: url, youtube: url, instagram: url }),
});
export type Team = z.infer<typeof teamSchema>;

export function load<T extends z.ZodTypeAny>(file: string, schema: T): z.infer<T> {
  const path = join(ROOT, 'config', file);
  if (!existsSync(path)) throw new Error(`설정 파일 없음: ${path}`);
  const res = schema.safeParse(parse(readFileSync(path, 'utf8')));
  if (!res.success) throw new Error(`${file} 형식 오류: ${res.error.message}`);
  return res.data;
}

export function loadTeams() {
  const t = load('teams.yaml', teamsSchema);
  const ids = t.teams.map((x) => x.id);
  if (new Set(ids).size !== ids.length) throw new Error('teams.yaml: 팀 id 중복');
  return t;
}

const siteSchema = z.object({ layout: z.enum(['soft', 'apple', 'magazine', 'classic']).default('classic'), community_section: z.boolean().default(false), news_images: z.boolean().default(false), home: z.enum(['front', 'simple']).default('simple'), article_modal: z.boolean().default(false), postseason_bracket: z.boolean().default(false), section_headings: z.boolean().default(false), brand_logo: z.boolean().default(false), team_logos: z.boolean().default(false), modal_blocked_hosts: z.array(z.string()).default([]), blocked_open: z.enum(['window', 'tab', 'same', 'modal']).default('modal'), revisit: z.boolean().default(false), push: z.boolean().default(false), news_cover: z.enum(['text', 'typo']).default('typo') });
/** 화면 레이아웃(config/site.yaml). 환경변수 SITE_LAYOUT 이 우선. 파일이 없으면 classic. */
export function siteLayout(): 'soft' | 'apple' | 'magazine' | 'classic' {
  const env = process.env.SITE_LAYOUT;
  if (env === 'soft' || env === 'apple' || env === 'magazine' || env === 'classic') return env;
  try { return load('site.yaml', siteSchema).layout; } catch { return 'classic'; }
}
/** 첫 화면: front(매일 바뀌는 스포츠 1면) | simple(팀 선택 + 최근 소식 격자, 이전 화면). 환경변수 SITE_HOME 이 우선. 파일이 없으면 simple. */
export function homeLayout(): 'front' | 'simple' {
  const env = process.env.SITE_HOME;
  if (env === 'front' || env === 'simple') return env;
  try { return load('site.yaml', siteSchema).home; } catch { return 'simple'; }
}
/** 구단 정식 로고(public/logos/<id>.png) 표시. 끄면 팀 컬러 이니셜 배지. 환경변수 SITE_LOGOS=on|off 가 우선. */
export function teamLogos(): boolean {
  const env = process.env.SITE_LOGOS;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).team_logos; } catch { return false; }
}
/** 첫 화면 맨 위 가을야구 대진(data/postseason.yaml). 환경변수 SITE_POSTSEASON=on|off 가 우선. 비시즌엔 false 로 끈다. */
export function postseasonBracket(): boolean {
  const env = process.env.SITE_POSTSEASON;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).postseason_bracket; } catch { return false; }
}
/** 섹션 제목 위 눈썹 라벨·구분선(2026-10-17 도입). 환경변수 SITE_HEADINGS=on|off 가 우선. 파일이 없으면 끔. */
export function sectionHeadings(): boolean {
  const env = process.env.SITE_HEADINGS;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).section_headings; } catch { return false; }
}
/** 헤더의 BBADDA 로고 이미지(public/brand/). 환경변수 SITE_BRAND_LOGO=on|off 가 우선. 끄면 글자 로고. */
export function brandLogo(): boolean {
  const env = process.env.SITE_BRAND_LOGO;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).brand_logo; } catch { return false; }
}
/** 기사 모달(사이트 안에서 원문을 띄움). 환경변수 SITE_MODAL=on|off 가 우선. 파일이 없으면 끔. */
export function articleModal(): { on: boolean; blocked: string[]; blockedOpen: 'window' | 'tab' | 'same' | 'modal' } {
  const env = process.env.SITE_MODAL;
  const envOpen = process.env.SITE_BLOCKED_OPEN;
  let cfg = { article_modal: false, modal_blocked_hosts: [] as string[], blocked_open: 'modal' as 'window' | 'tab' | 'same' | 'modal' };
  try { cfg = load('site.yaml', siteSchema); } catch { /* 기본값 */ }
  return { on: env === 'on' ? true : env === 'off' ? false : cfg.article_modal, blocked: cfg.modal_blocked_hosts, blockedOpen: envOpen === 'window' || envOpen === 'tab' || envOpen === 'same' || envOpen === 'modal' ? envOpen : cfg.blocked_open };
}
/** 뉴스 사진(원 매체 대표 이미지를 원 주소로 표시). 환경변수 SITE_NEWS_IMAGES=on|off 가 우선. 파일이 없으면 끔. */
export function newsImages(): boolean {
  const env = process.env.SITE_NEWS_IMAGES;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).news_images; } catch { return false; }
}
/** 사진 없는 뉴스 카드 커버: text(팀 컬러 바탕 + 구단명·매체명, 제목 반복 없음) | typo(제목 글자 커버). 환경변수 SITE_NEWS_COVER 가 우선. */
export function newsCover(): 'text' | 'typo' {
  const env = process.env.SITE_NEWS_COVER;
  if (env === 'text' || env === 'typo') return env;
  try { return load('site.yaml', siteSchema).news_cover; } catch { return 'typo'; }
}
/** 재방문 장치(승부예측 적중 기록·지난 방문 이후 새 소식 표시, config/site.yaml revisit). 환경변수 SITE_REVISIT=on|off 가 우선. */
export function revisit(): boolean {
  const env = process.env.SITE_REVISIT;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).revisit; } catch { return false; }
}
/** 경기 알림 받기 버튼(config/site.yaml push). 환경변수 SITE_PUSH=on|off 가 우선. */
export function pushButton(): boolean {
  const env = process.env.SITE_PUSH;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).push; } catch { return false; }
}
/** 커뮤니티 섹션(config/site.yaml). 환경변수 SITE_COMMUNITY=on|off 가 우선. */
export function communitySection(): boolean {
  const env = process.env.SITE_COMMUNITY;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).community_section; } catch { return false; }
}

const standingsSchema = z.object({
  label: z.string(),
  as_of: z.union([z.string(), z.date()]).transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10))),
  source: z.string().url(),
  teams: z.record(z.string(), z.object({ rank: z.number().int().min(1).max(10), streak: z.string().regex(/^\d+[승패무]$/, "'3승'·'2패' 형식") })),
});
/** 순위·연속(config/standings.yaml, 사람이 갱신). 파일이 없거나 형식이 틀리면 null — 화면은 순위 없이 기본 순서로. */
export function loadStandings() {
  try {
    const s = load('standings.yaml', standingsSchema);
    const ids = new Set(loadTeams().teams.map((t) => t.id));
    const ranks = Object.values(s.teams).map((t) => t.rank);
    if (Object.keys(s.teams).some((k) => !ids.has(k)) || new Set(ranks).size !== ranks.length) throw new Error('standings.yaml: 없는 팀 id 또는 순위 중복');
    return s;
  } catch (e) {
    if ((e as Error).message.startsWith('standings.yaml')) throw e;
    return null;
  }
}
/** '3승' → '3연승', '1승' → '1승', '2패' → '2연패' */
export const streakLabel = (s: string) => { const m = /^(\d+)([승패무])$/.exec(s); return !m ? s : Number(m[1]) >= 2 && m[2] !== '무' ? `${m[1]}연${m[2]}` : s; };

const sourcesSchema = z.object({
  http: z.object({ user_agent: z.string(), min_interval_ms: z.number(), timeout_ms: z.number() }),
  max_per_team_per_run: z.record(z.string(), z.number().int().positive()).default({}),
  max_league_per_run: z.number().int().positive().optional(),
  exclude_title_patterns: z.array(z.string()).default([]),
  enrich: z.object({ resolve_google_news: z.boolean(), og_image: z.boolean(), max_items: z.number() }).default({ resolve_google_news: false, og_image: false, max_items: 0 }),
  news_rss: z.object({ enabled: z.boolean(), when: z.string().default('7d'), max_items_per_feed: z.number().default(40), locale: z.object({ hl: z.string(), gl: z.string(), ceid: z.string() }), league_queries: z.array(z.string()).default([]) }),
  youtube: z.record(z.string(), z.any()).default({}),
  kakao: z.record(z.string(), z.any()).default({}),
  instagram: z.record(z.string(), z.any()).default({}),
  vertex: z.record(z.string(), z.any()).default({}),
});
const scoringSchema = z.object({
  hot: z.record(z.string(), z.number()),
  relevance: z.record(z.string(), z.number()),
  baseball_terms: z.array(z.string()),
  other_sports: z.array(z.string()).default([]),
  negative_words: z.array(z.string()).default([]),
  positive_words: z.array(z.string()).default([]),
});
export const loadSources = () => load('sources.yaml', sourcesSchema);
export const loadScoring = () => load('scoring.yaml', scoringSchema);
export type Sources = ReturnType<typeof loadSources>;
export type Scoring = ReturnType<typeof loadScoring>;

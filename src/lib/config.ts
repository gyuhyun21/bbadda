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

const siteSchema = z.object({ layout: z.enum(['magazine', 'classic']).default('classic'), community_section: z.boolean().default(false), news_images: z.boolean().default(false), home: z.enum(['front', 'simple']).default('simple') });
/** 화면 레이아웃(config/site.yaml). 환경변수 SITE_LAYOUT 이 우선. 파일이 없으면 classic. */
export function siteLayout(): 'magazine' | 'classic' {
  const env = process.env.SITE_LAYOUT;
  if (env === 'magazine' || env === 'classic') return env;
  try { return load('site.yaml', siteSchema).layout; } catch { return 'classic'; }
}
/** 첫 화면: front(매일 바뀌는 스포츠 1면) | simple(팀 선택 + 최근 소식 격자, 이전 화면). 환경변수 SITE_HOME 이 우선. 파일이 없으면 simple. */
export function homeLayout(): 'front' | 'simple' {
  const env = process.env.SITE_HOME;
  if (env === 'front' || env === 'simple') return env;
  try { return load('site.yaml', siteSchema).home; } catch { return 'simple'; }
}
/** 뉴스 사진(원 매체 대표 이미지를 원 주소로 표시). 환경변수 SITE_NEWS_IMAGES=on|off 가 우선. 파일이 없으면 끔. */
export function newsImages(): boolean {
  const env = process.env.SITE_NEWS_IMAGES;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).news_images; } catch { return false; }
}
/** 커뮤니티 섹션(config/site.yaml). 환경변수 SITE_COMMUNITY=on|off 가 우선. */
export function communitySection(): boolean {
  const env = process.env.SITE_COMMUNITY;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).community_section; } catch { return false; }
}

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

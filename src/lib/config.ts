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

const siteSchema = z.object({ layout: z.enum(['magazine', 'classic']).default('classic'), community_section: z.boolean().default(false) });
/** 화면 레이아웃(config/site.yaml). 환경변수 SITE_LAYOUT 이 우선. 파일이 없으면 classic. */
export function siteLayout(): 'magazine' | 'classic' {
  const env = process.env.SITE_LAYOUT;
  if (env === 'magazine' || env === 'classic') return env;
  try { return load('site.yaml', siteSchema).layout; } catch { return 'classic'; }
}
/** 커뮤니티 섹션(config/site.yaml). 환경변수 SITE_COMMUNITY=on|off 가 우선. */
export function communitySection(): boolean {
  const env = process.env.SITE_COMMUNITY;
  if (env === 'on' || env === 'off') return env === 'on';
  try { return load('site.yaml', siteSchema).community_section; } catch { return false; }
}

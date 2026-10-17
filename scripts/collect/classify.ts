// 팀 판별·모듈 분류·감성. 판별은 제목에서만 한다(발췌에는 사이드바 글자가 섞인다).
import type { Signal } from '../../src/lib/schemas.ts';
import type { Team, Scoring } from '../../src/lib/config.ts';
import { signalId, type RawItem } from './util.ts';

export type Cfg = { teams: Team[]; scoring: Scoring };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 위치 찾기: 라틴 문자 별칭은 앞뒤가 영문·숫자가 아닐 때만(예: 'NC' 가 'NCAA' 에 걸리지 않게), 한글은 부분 일치. 없으면 -1 */
export function findPos(hay: string, needle: string): number {
  if (/^[\x00-\x7F]+$/.test(needle)) {
    const m = new RegExp(`(^|[^A-Za-z0-9])(${escapeRe(needle)})(?![A-Za-z0-9])`, 'i').exec(hay);
    return m ? m.index + m[1].length : -1;
  }
  return hay.toLowerCase().indexOf(needle.toLowerCase());
}
export const has = (hay: string, needle: string) => findPos(hay, needle) >= 0;
export const hasBaseballTerm = (title: string, cfg: Pick<Cfg, 'scoring'>) => cfg.scoring.baseball_terms.some((w) => has(title, w));

/** 제목에 나온 팀 id(제목에 먼저 나온 순). 모기업·계열사 기사(exclude_any)는 빼고, 짧은 이름은 야구 단어가 함께 있을 때만 인정. */
export function findTeams(title: string, cfg: Cfg): string[] {
  // 짧은 이름은 야구 단어가 있고 다른 종목 단어가 없을 때만
  const baseball = hasBaseballTerm(title, cfg) && !cfg.scoring.other_sports.some((w) => has(title, w));
  const hits: { id: string; pos: number }[] = [];
  for (const t of cfg.teams) {
    if (t.exclude_any.some((p) => new RegExp(p, 'i').test(title))) continue;
    const strong = t.aliases.map((a) => findPos(title, a)).filter((p) => p >= 0);
    const weak = baseball ? t.weak_aliases.map((a) => findPos(title, a)).filter((p) => p >= 0) : [];
    const pos = Math.min(...strong, ...weak);
    if (Number.isFinite(pos)) hits.push({ id: t.id, pos });
  }
  return hits.sort((a, b) => a.pos - b.pos).map((h) => h.id);
}

export function sentimentOf(title: string, { scoring }: Pick<Cfg, 'scoring'>): Signal['sentiment'] {
  const neg = scoring.negative_words.some((w) => has(title, w));
  const pos = scoring.positive_words.some((w) => has(title, w));
  return neg && pos ? 'mixed' : neg ? 'negative' : pos ? 'positive' : 'neutral';
}

/** 해시태그를 뺀 제목에서 팀을 찾는다. 본문에 팀이 없을 때만 해시태그를 보되, 해시태그가 딱 한 팀일 때만 인정한다(여러 팀 해시태그를 붙인 쇼츠 대비). */
export function teamsOfTitle(title: string, cfg: Cfg): string[] {
  const body = title.replace(/#\S+/g, ' ');
  const inBody = findTeams(body, cfg);
  if (inBody.length || body === title) return inBody;
  const inTags = findTeams((title.match(/#\S+/g) ?? []).map((t) => t.slice(1)).join(' 야구 '), cfg);
  return inTags.length === 1 ? inTags : [];
}

/** 팀·모듈 결정. 버려야 하면 null(팀도 리그도 아닌 글). */
export function classify(raw: RawItem, cfg: Cfg): (Pick<Signal, 'module' | 'team' | 'teams'> & { team_inferred?: true }) | null {
  const titleTeams = teamsOfTitle(raw.title, cfg);
  // 제목에 팀 이름이 없으면, 그 팀 검색어로 들어왔고 제목에 야구 단어가 있을 때(다른 종목 단어 없이) 검색어의 팀으로 본다
  const baseballTitle = hasBaseballTerm(raw.title, cfg) && !cfg.scoring.other_sports.some((w) => has(raw.title, w));
  const inferred = !titleTeams.length && !raw.team_hint && baseballTitle && raw.query_teams?.length ? [...new Set(raw.query_teams)] : [];
  const found = titleTeams.length ? titleTeams : inferred;
  const mark = inferred.length ? { team_inferred: true as const } : {};
  const c = classifyTeams(raw, found, cfg);
  return c ? { ...c, ...mark } : null;
}

function classifyTeams(raw: RawItem, found: string[], cfg: Cfg): Pick<Signal, 'module' | 'team' | 'teams'> | null {
  // 구단 공식 채널 글은 제목에 팀 이름이 없어도 그 팀 소식
  const hint = raw.team_hint && raw.team_hint !== 'kbo' ? raw.team_hint : undefined;
  const teams = hint && !found.includes(hint) ? [hint, ...found] : found;
  const team = hint ?? teams[0];
  if (raw.via === 'fans') return team ? { module: 'fans', team, teams } : null;
  if (raw.official && raw.team_hint === 'kbo') return { module: 'league', teams, ...(team ? { team } : {}) };
  if (teams.length === 0) return raw.via === 'league' && hasBaseballTerm(raw.title, cfg) ? { module: 'league', teams: [] } : null;
  if (teams.length >= 2 && !hint) return { module: 'rivalry', team: team!, teams };
  return { module: 'team', team: team!, teams };
}

/** 언론이 전한 공식 발표: 제목의 [오피셜]·[공식발표]·[공식] */
export const ANNOUNCEMENT = /\[(오피셜|공식\s?발표|공식)\]|공식\s?발표/;

export function toSignal(raw: RawItem, c: Pick<Signal, 'module' | 'team' | 'teams'> & { team_inferred?: true }, issue: string, now: Date, cfg: Cfg): Signal {
  return {
    id: signalId(raw.source_type, raw.url),
    issue,
    ...c,
    source_type: raw.source_type,
    ...(raw.official ? { official: true } : {}),
    ...(!raw.official && ANNOUNCEMENT.test(raw.title) ? { announcement: true } : {}),
    source_name: raw.source_name,
    url: raw.url,
    ...(raw.image ? { image: raw.image } : {}),
    title: raw.title,
    published_at: raw.published_at,
    collected_at: now.toISOString(),
    summary_ko: '',
    ...(raw.excerpt ? { excerpt: raw.excerpt } : {}),
    ...(raw.slang ? { slang: raw.slang } : {}),
    metrics: raw.metrics ?? {},
    scores: { hot: 0, relevance: 0 },
    sentiment: sentimentOf(raw.title, cfg),
  };
}

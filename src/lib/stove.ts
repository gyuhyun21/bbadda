// 스토브리그 FA 행선지(첫 화면 히어로): data/stove.yaml → 화제 선수 먼저, 계약 상태, 구단별 이동.
// 모든 값은 기사·구단 발표로 확인한 것만(출처 URL 필수). 몸값은 '보도 범위'만, 우리 추정치는 쓰지 않는다.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';

const dateStr = z.union([z.string(), z.date()]).transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10)));
const src = z.string().url();
// 장단점 한 줄: record = 출처 링크가 붙은 기록, report = 기사에 나온 평가. 우리 해석은 싣지 않는다(저장소 주인 결정, 2026-10-29)
const point = z.object({ text: z.string().max(40), kind: z.enum(['record', 'report']), source: src });
export const FA_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const stoveSchema = z.object({
  season: z.number().int(), // FA 계약이 시작되는 시즌(예: 2027)
  as_of: dateStr.optional(),
  list_source: src.optional(), // FA 승인 선수 명단 근거(KBO 공시 보도·발표)
  players: z.array(z.object({
    id: z.string().max(40).regex(FA_SLUG),
    name: z.string(),
    source: src.optional(), // list_source 명단에 없는 선수의 FA(예정) 근거 기사
    from: z.string(), // 원소속 팀 id
    pos: z.string(),
    age: z.number().int().optional(),
    grade: z.enum(['A', 'B', 'C']).optional(),
    hot: z.boolean().default(false), // 화제 선수: 위에 펼쳐 보인다. 나머지는 접힌 목록
    interest: z.array(z.object({ team: z.string(), sources: z.array(src).min(1) })).default([]),
    price: z.object({ text: z.string().max(30), sources: z.array(src).min(1) }).optional(),
    signed: z.object({ team: z.string(), terms: z.string().max(60), date: dateStr, source: src }).optional(),
    pros: z.array(point).max(2).default([]),
    cons: z.array(point).max(2).default([]),
  })).default([]),
});
export type StoveData = z.infer<typeof stoveSchema>;
export type FaPlayer = StoveData['players'][number];

export function loadStove(root = process.cwd()): StoveData | null {
  const p = join(root, 'data', 'stove.yaml');
  if (!existsSync(p)) return null;
  return stoveSchema.parse(parse(readFileSync(p, 'utf8')));
}

export type FaStatus = 'open' | 'moved' | 'stayed';
export const statusOf = (p: FaPlayer): FaStatus => (!p.signed ? 'open' : p.signed.team === p.from ? 'stayed' : 'moved');

/** 화제 선수(hot) 먼저, 그 안에서 미계약 먼저, 그다음 데이터 순서 */
export function orderPlayers(players: FaPlayer[]): FaPlayer[] {
  return players.map((p, i) => ({ p, i })).sort((a, b) => Number(b.p.hot) - Number(a.p.hot) || Number(!!a.p.signed) - Number(!!b.p.signed) || a.i - b.i).map((x) => x.p);
}

/** 행선지 투표 보기: 원소속 팀 + 관심 구단(+ 계약한 팀) */
export const voteTeams = (p: FaPlayer): string[] => [...new Set([p.from, ...p.interest.map((x) => x.team), ...(p.signed ? [p.signed.team] : [])])];

/** 투표 id — api/_vote.ts parseFaId 와 같은 형식 */
export const faVoteId = (season: number, p: FaPlayer) => `fa${season}-${p.id}`;

/** 구단별 이동 수 */
export function moves(players: FaPlayer[], team: string) {
  let gain = 0, loss = 0, stay = 0;
  for (const p of players) {
    if (!p.signed) continue;
    if (p.signed.team === p.from) { if (p.from === team) stay++; }
    else { if (p.signed.team === team) gain++; if (p.from === team) loss++; }
  }
  return { gain, loss, stay };
}

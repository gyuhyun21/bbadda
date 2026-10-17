// 포스트시즌 대진 계산: data/postseason.yaml → 라운드별 팀·전적·승자, 경기별 요일·시각·구장, 다음 경기.
// astro 를 불러오지 않는 순수 함수라 테스트와 화면이 같이 쓴다.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';

const dateStr = z.union([z.string(), z.date()]).transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10)));
const slot = z.union([z.string(), z.object({ winner_of: z.string() })]);
const venue = z.union([z.string(), z.object({ home_of: z.string() })]);
export const postseasonSchema = z.object({
  season: z.number(),
  schedule_source: z.string().url(),
  time: z.object({ weekday: z.string(), weekend: z.string() }),
  home: z.record(z.string(), z.string()),
  rounds: z.array(z.object({
    id: z.string(), name: z.string(), short: z.string(), to_win: z.number().int().min(1),
    advantage: z.record(z.string(), z.number().int()).default({}),
    teams: z.tuple([slot, slot]),
    games: z.array(z.object({
      no: z.number().int(), date: dateStr, venue,
      result: z.record(z.string(), z.number().int()).optional(), source: z.string().url().optional(),
      // 경기 기록(MLB.com 경기 결과 카드 참고) — 모두 기사로 확인한 것만, 출처는 sources
      starters: z.record(z.string(), z.string()).optional(), // 팀 id → 선발(경기 전엔 예고 선발)
      win: z.string().optional(), loss: z.string().optional(), save: z.string().optional(), holds: z.array(z.string()).default([]),
      homers: z.array(z.string()).default([]), mvp: z.string().optional(), attendance: z.string().optional(),
      starter_notes: z.record(z.string(), z.string()).optional(), // 팀 id → 선발의 시즌 성적 한 줄(다음 경기 카드)
      facts: z.array(z.string()).default([]), // 관전 포인트(다음 경기 카드 가운데 칸)
      highlight: z.string().url().optional(), // 하이라이트 영상(없으면 수집된 공식 YouTube 에서 자동으로 찾는다)
      sources: z.array(z.string().url()).default([]),
    })),
  })),
});
export type PostseasonData = z.infer<typeof postseasonSchema>;

export function loadPostseason(root = process.cwd()): PostseasonData | null {
  const p = join(root, 'data', 'postseason.yaml');
  if (!existsSync(p)) return null;
  return postseasonSchema.parse(parse(readFileSync(p, 'utf8')));
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
export type Side = { id?: string; label: string; wins: number };
export type GameRecord = { highlight?: string; starters: [string?, string?]; starterNotes: [string?, string?]; facts: string[]; win?: string; loss?: string; save?: string; holds: string[]; homers: string[]; mvp?: string; attendance?: string; sources: string[] };
export type GameView = { round: string; roundName: string; no: number; date: string; weekday: string; time: string; venue: string; played: boolean; score?: string; sides: [Side, Side]; skipped: boolean; ifNeeded: boolean; record: GameRecord };
export type RoundView = { id: string; name: string; short: string; toWin: number; sides: [Side, Side]; winner?: string; status: 'done' | 'live' | 'upcoming'; games: GameView[]; next?: GameView };

/** 라운드를 앞에서부터 풀어 팀·전적·승자를 정한다. today: 'YYYY-MM-DD'(한국 날짜) */
export function resolvePostseason(d: PostseasonData, today: string): { rounds: RoundView[]; next?: GameView } {
  const winners = new Map<string, string>();
  const shortOf = new Map(d.rounds.map((r) => [r.id, r.short]));
  const rounds: RoundView[] = d.rounds.map((r) => {
    const ids = r.teams.map((t) => (typeof t === 'string' ? t : winners.get(t.winner_of)));
    const labels = r.teams.map((t, i) => ids[i] ?? `${shortOf.get((t as { winner_of: string }).winner_of) ?? ''} 승자`);
    const wins = ids.map((id) => (id ? r.advantage[id] ?? 0 : 0));
    let winner: string | undefined;
    const games: GameView[] = r.games.map((g) => {
      const day = new Date(`${g.date}T00:00:00Z`).getUTCDay();
      const venueName = typeof g.venue === 'string' ? g.venue : (winners.get(g.venue.home_of) && d.home[winners.get(g.venue.home_of)!]) || `${shortOf.get(g.venue.home_of)} 승자 홈`;
      const skipped = !!winner; // 시리즈가 이미 끝났으면 남은 경기는 열리지 않는다
      let score: string | undefined;
      if (g.result && !skipped) {
        const [a, b] = ids;
        const sa = a ? g.result[a] : undefined, sb = b ? g.result[b] : undefined;
        if (sa !== undefined && sb !== undefined) {
          if (sa > sb) wins[0]++; else if (sb > sa) wins[1]++;
          score = `${sa}-${sb}`;
        }
        if (wins[0] >= r.to_win) winner = ids[0]; else if (wins[1] >= r.to_win) winner = ids[1];
      }
      return {
        round: r.id, roundName: r.name, no: g.no, date: g.date, weekday: WEEKDAY[day], time: day === 0 || day === 6 ? d.time.weekend : d.time.weekday,
        venue: venueName, played: !!score, score, skipped, ifNeeded: g.no > r.to_win,
        record: { highlight: g.highlight, starters: [ids[0] ? g.starters?.[ids[0]] : undefined, ids[1] ? g.starters?.[ids[1]] : undefined], starterNotes: [ids[0] ? g.starter_notes?.[ids[0]] : undefined, ids[1] ? g.starter_notes?.[ids[1]] : undefined], facts: g.facts, win: g.win, loss: g.loss, save: g.save, holds: g.holds, homers: g.homers, mvp: g.mvp, attendance: g.attendance, sources: [...(g.source ? [g.source] : []), ...g.sources] },
        sides: [{ id: ids[0], label: labels[0], wins: 0 }, { id: ids[1], label: labels[1], wins: 0 }],
      };
    });
    if (winner) winners.set(r.id, winner);
    const sides: [Side, Side] = [{ id: ids[0], label: labels[0], wins: wins[0] }, { id: ids[1], label: labels[1], wins: wins[1] }];
    games.forEach((g) => (g.sides = sides));
    const status = winner ? 'done' : games.some((g) => g.played) || wins.some((w) => w > 0) ? 'live' : 'upcoming';
    const next = winner ? undefined : games.find((g) => !g.played && !g.skipped && g.date >= today);
    return { id: r.id, name: r.name, short: r.short, toWin: r.to_win, sides, winner, status, games, next };
  });
  const next = rounds.map((r) => r.next).filter((g): g is GameView => !!g).sort((a, b) => a.date.localeCompare(b.date))[0];
  return { rounds, next };
}

/** 가장 최근에 끝난 경기(지난 경기 요약용) */
export function lastPlayed(rounds: RoundView[]): GameView | undefined {
  return rounds.flatMap((r) => r.games.filter((g) => g.played)).sort((a, b) => b.date.localeCompare(a.date))[0];
}

// 라운드별 제목 표기(공식 하이라이트 영상 제목에서 찾는다)
const ROUND_WORDS: Record<string, string[]> = { wc: ['WC', '와일드카드'], spo: ['준PO', '준플레이오프'], po: ['PO', '플레이오프'], ks: ['KS', '한국시리즈'] };
type Video = { url: string; title: string; published_at: string; source_type: string; official?: boolean };
/** 수집된 공식 YouTube(KBO·구단) 영상 중 그 경기 하이라이트. 제목에 라운드·차전·'하이라이트|H/L' 이 모두 있어야 한다 */
export function findHighlight(videos: Video[], g: GameView): string | undefined {
  if (g.record.highlight) return g.record.highlight;
  const words = ROUND_WORDS[g.round] ?? [];
  const md = `${Number(g.date.slice(5, 7))}.${g.date.slice(8, 10)}`;
  const hit = videos.filter((v) => v.source_type === 'youtube' && v.official && v.published_at.slice(0, 10) >= g.date)
    .filter((v) => /하이라이트|H\/L|highlight/i.test(v.title))
    .filter((v) => words.some((w) => (g.round === 'po' ? new RegExp(`(?<!준)${w}`) : new RegExp(w)).test(v.title)))
    .filter((v) => new RegExp(`${g.no}차전|${words[0]}\\s?${g.no}(?!\\d)`).test(v.title) || v.title.includes(md))
    .sort((a, b) => a.published_at.localeCompare(b.published_at));
  return hit[0]?.url;
}

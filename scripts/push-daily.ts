// 매일 오전 11시 알림 문구(2026-10-24 주인 결정): 경기 있는 날은 경기 안내(승부예측 유도), 없는 날은 오늘 소식 3줄 요약.
// 사용: npx tsx scripts/push-daily.ts  → 표준 출력에 JSON 메시지 하나 또는 null. 문구는 사이트 데이터(brief_ko·postseason.yaml)만 쓴다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPostseason, resolvePostseason, type GameView } from '../src/lib/postseason.ts';
import { loadTeams } from '../src/lib/config.ts';
import type { PushMsg } from '../api/_push.ts';

type Sig = { team?: string; brief_ko?: string; hook_ko?: string; collected_at: string; scores: { hot: number } };
const short = new Map(loadTeams().teams.map((t) => [t.id, t.short]));
const nm = (s: GameView['sides'][number]) => (s.id ? short.get(s.id) ?? s.id : s.label);
const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);
const URL = '/?utm_source=push&utm_medium=daily';

export function daily(sigs: Sig[], next: GameView | undefined, roundShort: string | undefined, today: string): PushMsg | null {
  if (next && next.date === today && next.sides.every((s) => s.id)) {
    return { title: `오늘 ${next.time} ${roundShort ?? ''} ${next.no}차전, 승리팀을 맞춰라!`.replace(/\s+/g, ' '), body: `${nm(next.sides[0])} vs ${nm(next.sides[1])} · 예고 선발과 관전 포인트 보고 예측 투표하기 →`, url: URL, tag: `daily-${today}` };
  }
  // 오늘 수집한 구단별 한 줄 중 후크·화제 순으로, 같은 팀은 한 번만
  const seen = new Set<string>(); const lines: string[] = [];
  for (const s of sigs.filter((x) => x.brief_ko && kstDay(x.collected_at) === today).sort((a, b) => Number(!!b.hook_ko) - Number(!!a.hook_ko) || b.scores.hot - a.scores.hot)) {
    if (seen.has(s.team ?? '')) continue;
    seen.add(s.team ?? ''); lines.push(s.brief_ko!);
    if (lines.length === 3) break;
  }
  if (!lines.length) return null;
  return { title: '오늘 KBO, 3줄 요약 🔔', body: lines.map((l, i) => `${'①②③'[i]} ${l}`).join('\n').slice(0, 160), url: URL, tag: `daily-${today}` };
}

if (process.argv[1]?.endsWith('push-daily.ts')) {
  const today = process.env.PUSH_DATE && /^\d{4}-\d{2}-\d{2}$/.test(process.env.PUSH_DATE) ? process.env.PUSH_DATE : kstDay(new Date().toISOString());
  const sigs: Sig[] = [];
  const root = join(process.cwd(), 'src/content/signals');
  for (const w of readdirSync(root)) if (/^\d{4}-W\d{2}$/.test(w)) for (const f of readdirSync(join(root, w))) if (f.endsWith('.json') && !f.startsWith('.')) sigs.push(JSON.parse(readFileSync(join(root, w, f), 'utf8')));
  const d = loadPostseason(); const v = d ? resolvePostseason(d, today) : null;
  const r = v?.next ? v.rounds.find((x) => x.id === v.next!.round) : undefined;
  console.log(JSON.stringify(daily(sigs, v?.next, r?.short, today)));
}

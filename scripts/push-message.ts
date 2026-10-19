// 경기 알림 메시지: data/postseason.yaml 의 직전 커밋(이전)과 지금을 비교해 새로 채워진 경기 결과·예고 선발을 알림 문구로 만든다.
// 사용: npx tsx scripts/push-message.ts <이전 루트 폴더>  → 표준 출력에 JSON 배열(최대 2개, 없으면 [])
// .github/workflows/push.yml 이 부른다. 알림 문구는 화면과 같은 데이터만 쓴다(추론 없음).
import { loadPostseason, resolvePostseason, type GameView, type RoundView } from '../src/lib/postseason.ts';
import { loadTeams } from '../src/lib/config.ts';
import type { PushMsg } from '../api/_push.ts';

const short = new Map(loadTeams().teams.map((t) => [t.id, t.short]));
const nm = (s: GameView['sides'][number]) => (s.id ? short.get(s.id) ?? s.id : s.label);
const key = (g: GameView) => `${g.round}${g.no}`;
const md = (g: GameView) => `${Number(g.date.slice(5, 7))}/${Number(g.date.slice(8, 10))}(${g.weekday})`;

export function messages(prev: RoundView[], cur: RoundView[]): PushMsg[] {
  const before = new Map(prev.flatMap((r) => r.games.map((g) => [key(g), g] as const)));
  const out: PushMsg[] = [];
  for (const r of cur) for (const g of r.games) {
    const p = before.get(key(g));
    if (g.played && g.score && !p?.played) {
      const [a, b] = g.score.split('-').map(Number);
      const [w, l] = a >= b ? [0, 1] : [1, 0];
      const series = r.winner ? `${short.get(r.winner) ?? r.winner} ${r.short} 통과` : `시리즈 ${nm(r.sides[0])} ${r.sides[0].wins}-${r.sides[1].wins} ${nm(r.sides[1])}`;
      out.push({ title: `${r.short} ${g.no}차전 결과`, body: `${nm(g.sides[w])} ${Math.max(a, b)}-${Math.min(a, b)} ${nm(g.sides[l])} · ${series}`, url: '/', tag: `result-${key(g)}` });
    } else if (!g.played && g.record.starters.every(Boolean) && !p?.record.starters.every(Boolean)) {
      out.push({ title: `${r.short} ${g.no}차전 예고 선발`, body: `${md(g)} ${g.time} ${g.venue} · ${nm(g.sides[0])} ${g.record.starters[0]} vs ${nm(g.sides[1])} ${g.record.starters[1]}`, url: '/', tag: `starters-${key(g)}` });
    }
  }
  return out.slice(0, 2);
}

if (process.argv[1]?.endsWith('push-message.ts')) {
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const cur = loadPostseason();
  const prev = loadPostseason(process.argv[2]);
  console.log(JSON.stringify(cur && prev ? messages(resolvePostseason(prev, today).rounds, resolvePostseason(cur, today).rounds) : []));
}

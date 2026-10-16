// npm run draft [-- --week=YYYY-Www] — 주간호 골격(TODO 포함) + 모듈별 후보. 골격에 TODO 가 남으면 validate·build 가 실패한다(미완성 발행 방지).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { ROOT, loadTeams } from '../src/lib/config.ts';
import { issueIdOf, periodOfIssue, toKstDate } from '../src/lib/week.ts';
import { readJsonDir, contentDir } from '../src/lib/fsdata.ts';
import { signalSchema, type Signal } from '../src/lib/schemas.ts';

const week = process.argv.find((a) => a.startsWith('--week='))?.slice(7) ?? issueIdOf(new Date());
const cur: Signal[] = readJsonDir(join(contentDir(ROOT, 'signals'), week)).flatMap((l) => { const p = signalSchema.safeParse(l.data); return p.success ? [p.data] : []; });
if (!cur.length) { console.error(`signals ${week} 가 없습니다. 먼저 npm run collect 를 실행하세요.`); process.exit(1); }
const rank = (a: Signal, b: Signal) => b.scores.hot + b.scores.relevance - (a.scores.hot + a.scores.relevance);
const teams = loadTeams().teams.map((t) => t.id);
// 후보: 리그·라이벌 상위, 팀별 상위 — 편집자가 출발점으로 쓴다
const candidates = {
  league: cur.filter((s) => s.module === 'league').sort(rank).slice(0, 8).map((s) => s.id),
  rivalry: cur.filter((s) => s.module === 'rivalry').sort(rank).slice(0, 8).map((s) => s.id),
  ...Object.fromEntries(teams.map((t) => [t, cur.filter((s) => s.team === t && s.module !== 'league').sort(rank).slice(0, 8).map((s) => s.id)])),
};
mkdirSync(join(ROOT, 'data', 'drafts'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'drafts', `${week}-candidates.json`), JSON.stringify(candidates, null, 2) + '\n');

const file = join(contentDir(ROOT, 'issues'), `${week}.md`);
if (!existsSync(file)) {
  const { start, end } = periodOfIssue(week);
  const top = [...cur].sort(rank);
  const front = {
    vol: week, title: `BBADDA ${week}`, published_at: toKstDate(new Date()), period_start: start, period_end: end,
    cover_signals: top.slice(0, 6).map((s) => s.id),
    brief: [0, 1, 2].map((i) => ({ text: 'TODO: 무엇이 일어났나 → 왜 중요한가 (3문장 이내)', evidence: [top[i]?.id ?? 'TODO'] })),
    editorial: { league: 'TODO', teams: Object.fromEntries(teams.map((t) => [t, 'TODO'])), community: 'TODO' },
    status: 'draft',
  };
  mkdirSync(contentDir(ROOT, 'issues'), { recursive: true });
  writeFileSync(file, `---\n${stringify(front)}---\n`);
}
console.log(`draft ${week}: signals ${cur.length} → issues/${week}.md, data/drafts/${week}-candidates.json`);

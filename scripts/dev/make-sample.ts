// 화면 확인용 SAMPLE 데이터 — 가상 제목·example.com 주소만 쓴다(실제 기사처럼 보이지 않게). 지우기: npm run clear-sample
// 실행: npx tsx scripts/dev/make-sample.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { loadTeams } from '../../src/lib/config.ts';
import { collectingIssueId, periodOfIssue, addWeeks } from '../../src/lib/week.ts';

const teams = loadTeams().teams.map((t) => t.id);
const now = new Date();
const cur = collectingIssueId(now); // 진행 중인 호(매일 갱신분)
const last = addWeeks(cur, -1); // 발행된 SAMPLE 호
const modules = ['team', 'team', 'fans', 'team', 'rivalry', 'league'] as const;
const sources = ['news', 'news', 'youtube', 'news', 'news', 'news'] as const;
let n = 0;
const make = (issue: string, ageDays: number) => {
  const dir = join('src/content/signals', issue);
  mkdirSync(dir, { recursive: true });
  const ids: string[] = [];
  teams.forEach((t, ti) => modules.forEach((m, mi) => {
    if ((ti + mi) % 3 === 2) return;
    const id = `sample-${issue}-${t}-${mi}`;
    const other = teams[(ti + 1) % teams.length];
    const tlist = m === 'rivalry' ? [t, other] : m === 'league' ? [] : [t];
    const s = {
      id, issue, module: m, ...(m === 'league' ? {} : { team: t }), teams: tlist,
      source_type: m === 'fans' ? (mi % 2 ? 'community' : 'youtube') : sources[mi],
      source_name: m === 'fans' ? '예시 커뮤니티' : '예시일보', url: `https://example.com/sample/${id}`,
      title: `[SAMPLE] ${m === 'league' ? 'KBO 리그' : t.toUpperCase()} 예시 기사 제목 ${++n}`,
      published_at: new Date(now.getTime() - (ageDays + (mi % 5)) * 86400_000).toISOString(),
      collected_at: now.toISOString(),
      summary_ko: '화면 확인용 예시 요약입니다. 실제 사실이 아닙니다.',
      ...(mi === 2 && ti % 4 === 0 ? { slang: '예시은어' } : {}),
      metrics: {}, scores: { hot: 90 - mi * 10, relevance: 50 }, sentiment: 'neutral', sample: true,
    };
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(s, null, 2) + '\n');
    ids.push(id);
  }));
  return ids;
};
const ids = make(last, 3);
make(cur, 0);
const { start, end } = periodOfIssue(last);
const issue = {
  vol: last, title: `[SAMPLE] BBADDA ${last}`, published_at: end, period_start: start, period_end: end,
  cover_signals: ids.slice(0, 6), brief: [0, 1, 2].map((i) => ({ text: `SAMPLE 브리프 ${i + 1} — 무엇이 일어났나 → 왜 중요한가(예시).`, evidence: [ids[i * 3]] })),
  editorial: {
    league: 'SAMPLE 리그 요지 한 줄(예시)\n- **일정** 예시 설명\n- **흥행** 예시 설명',
    teams: Object.fromEntries(teams.map((t) => [t, `SAMPLE ${t.toUpperCase()} 이번 주 요지(예시)\n- **팀 소식** 예시 설명\n- **팬 반응** 예시 설명`])),
    community: 'SAMPLE 커뮤니티 요지(예시)',
  },
  status: 'published', sample: true,
};
mkdirSync('src/content/issues', { recursive: true });
writeFileSync(`src/content/issues/${last}.md`, `---\n${stringify(issue)}---\n`);
console.log(`SAMPLE: 호 ${last}, 진행 중 ${cur}`);

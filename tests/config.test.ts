import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTeams, loadStandings, streakLabel } from '../src/lib/config.ts';

test('teams.yaml: 10개 구단, id 고유, 별칭 있음', () => {
  const { teams } = loadTeams();
  assert.equal(teams.length, 10);
  assert.equal(new Set(teams.map((t) => t.id)).size, 10);
  for (const t of teams) assert.ok(t.aliases.includes(t.name), `${t.id}: 정식 이름이 aliases 에 있어야 함`);
});
test('teams.yaml: exclude_any 정규식이 모두 컴파일됨', () => {
  for (const t of loadTeams().teams) for (const p of t.exclude_any) new RegExp(p, 'i');
});
test('standings.yaml: 10팀, 순위 1~10 고유, 연속 형식', () => {
  const s = loadStandings();
  assert.ok(s);
  assert.equal(Object.keys(s!.teams).length, 10);
  assert.deepEqual(Object.values(s!.teams).map((t) => t.rank).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
test('연속 표기: 2 이상은 연승·연패, 1은 그대로', () => {
  assert.equal(streakLabel('10승'), '10연승');
  assert.equal(streakLabel('2패'), '2연패');
  assert.equal(streakLabel('1승'), '1승');
});

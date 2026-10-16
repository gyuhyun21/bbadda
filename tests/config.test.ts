import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTeams } from '../src/lib/config.ts';

test('teams.yaml: 10개 구단, id 고유, 별칭 있음', () => {
  const { teams } = loadTeams();
  assert.equal(teams.length, 10);
  assert.equal(new Set(teams.map((t) => t.id)).size, 10);
  for (const t of teams) assert.ok(t.aliases.includes(t.name), `${t.id}: 정식 이름이 aliases 에 있어야 함`);
});
test('teams.yaml: exclude_any 정규식이 모두 컴파일됨', () => {
  for (const t of loadTeams().teams) for (const p of t.exclude_any) new RegExp(p, 'i');
});

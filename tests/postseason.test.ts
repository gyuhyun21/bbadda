import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPostseason, resolvePostseason } from '../src/lib/postseason.ts';
import { loadTeams } from '../src/lib/config.ts';

const d = loadPostseason()!;
test('포스트시즌: 파일 형식·팀 id', () => {
  const ids = new Set(loadTeams().teams.map((t) => t.id));
  for (const r of d.rounds) for (const t of r.teams) if (typeof t === 'string') assert.ok(ids.has(t), t);
});
test('와일드카드: LG 1승 안고 1차전 승리 → 진출, 2차전은 열리지 않음', () => {
  const { rounds } = resolvePostseason(d, '2026-10-17');
  const wc = rounds[0];
  assert.equal(wc.winner, 'lg');
  assert.equal(wc.games[1].skipped, true);
  assert.deepEqual(rounds[1].sides.map((s) => s.label), ['lg', 'kia']); // 준PO 상대 확정
  assert.equal(rounds[1].games[2].venue, '잠실'); // 'WC 승리팀 홈' → LG 홈
  assert.equal(rounds[2].sides[0].label, '준PO 승자');
  assert.equal(rounds[2].games[2].venue, '준PO 승자 홈');
});
test('요일·시각은 날짜로 계산(일정표의 PO 5차전 31(목) 오류 바로잡힘)', () => {
  const { rounds, next } = resolvePostseason(d, '2026-10-17');
  const po5 = rounds[2].games[4];
  assert.equal(po5.weekday, '토');
  assert.equal(po5.time, '14:00');
  assert.equal(rounds[3].games[0].weekday, '월');
  assert.equal(rounds[3].games[0].time, '18:30');
  assert.equal(next?.round, 'spo');
  assert.equal(next?.no, 1);
  assert.equal(next?.date, '2026-10-17');
});
test('준PO 결과가 들어오면 전적·다음 경기가 바뀐다', () => {
  const copy = structuredClone(d);
  copy.rounds[1].games[0].result = { lg: 2, kia: 5 };
  const { rounds, next } = resolvePostseason(copy, '2026-10-18');
  assert.deepEqual(rounds[1].sides.map((s) => s.wins), [0, 1]);
  assert.equal(rounds[1].status, 'live');
  assert.equal(next?.no, 2);
});
test('경기 기록: 선발은 대진 순서대로, 출처는 결과 기사 + 기록 기사', () => {
  const { rounds, next } = resolvePostseason(d, '2026-10-17');
  const wc1 = rounds[0].games[0];
  assert.deepEqual(wc1.record.starters, ['곽빈', '카라스코']); // teams: [doosan, lg]
  assert.equal(wc1.record.win, '카라스코');
  assert.ok(wc1.record.sources.length >= 2);
  assert.deepEqual(next?.record.starters, ['톨허스트', '네일']); // 준PO: [WC 승자(lg), kia]
  assert.equal(rounds[1].games[3].ifNeeded, true); // 3선승제 4차전은 미확정
  assert.equal(rounds[1].games[2].ifNeeded, false);
});

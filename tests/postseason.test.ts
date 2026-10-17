import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPostseason, resolvePostseason, lastPlayed, findHighlight } from '../src/lib/postseason.ts';
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
  assert.equal(next?.round, 'spo'); // 1차전 결과가 들어가 다음 경기는 2차전
  assert.equal(next?.no, 2);
  assert.equal(next?.date, '2026-10-18');
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
  assert.deepEqual(rounds[1].games[0].record.starters, ['톨허스트', '네일']); // 준PO: [WC 승자(lg), kia]
  assert.deepEqual(next?.record.starters, ['임찬규', '올러']);
  assert.equal(next?.record.starterNotes[1], '올해 LG전 2승 1패 · ERA 2.40');
  assert.ok(next!.record.facts.length >= 1);
  assert.equal(rounds[1].games[3].ifNeeded, true); // 3선승제 4차전은 미확정
  assert.equal(rounds[1].games[2].ifNeeded, false);
});
test('지난 경기와 하이라이트 찾기', () => {
  const { rounds } = resolvePostseason(d, '2026-10-17');
  const last = lastPlayed(rounds)!;
  assert.equal(last.round, 'spo'); assert.equal(last.no, 1);
  const wc1 = rounds[0].games[0];
  const v = (title: string, official = true, at = '2026-10-14T13:00:00Z') => ({ url: `https://www.youtube.com/watch?v=${encodeURIComponent(title).slice(0, 11)}`, title, published_at: at, source_type: 'youtube', official });
  const vids = [v('[두산베어스 vs LG트윈스] 10.14(수) WC 1차전 하이라이트｜2026'), v('준PO 1차전 하이라이트', true, '2026-10-17T09:00:00Z'), v('WC 1차전 하이라이트 팬 리액션', false)];
  assert.equal(findHighlight(vids, wc1), vids[0].url);
  assert.equal(findHighlight(vids, last), vids[1].url);
  assert.equal(findHighlight([v('PO 1차전 하이라이트', true, '2026-10-26T00:00:00Z')], last), undefined); // 준PO 경기에 PO 영상은 안 붙는다
});

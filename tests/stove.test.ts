import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStove, orderPlayers, statusOf, voteTeams, faVoteId, moves } from '../src/lib/stove.ts';
import { parseFaId, parseGameId } from '../api/_vote.ts';

const d = loadStove('tests/fixtures')!;

test('FA: 화제 선수 먼저, 그 안에서 미계약 먼저', () => {
  assert.deepEqual(orderPlayers(d.players).map((p) => p.id), ['player-c', 'player-b', 'player-a']);
});
test('FA: 계약 상태·투표 보기·구단별 이동', () => {
  const [a, b, c] = d.players;
  assert.deepEqual([a, b, c].map(statusOf), ['moved', 'stayed', 'open']);
  assert.deepEqual(voteTeams(c), ['lg', 'hanwha', 'lotte']);
  assert.deepEqual(voteTeams(a), ['lg', 'samsung']);
  assert.deepEqual(moves(d.players, 'lg'), { gain: 0, loss: 1, stay: 0 });
  assert.deepEqual(moves(d.players, 'samsung'), { gain: 1, loss: 0, stay: 0 });
  assert.deepEqual(moves(d.players, 'kia'), { gain: 0, loss: 0, stay: 1 });
});
test('FA 투표 id: 화면이 만든 id 를 API 가 받고, 경기 id 와 섞이지 않는다', () => {
  const id = faVoteId(d.season, d.players[2]);
  assert.equal(id, 'fa2027-player-c');
  assert.equal(parseFaId(id)?.teams.length, 10);
  assert.equal(parseGameId(id), null);
  assert.equal(parseFaId('fa2027-Player'), null);
  assert.equal(parseFaId('fa2027-'), null);
  assert.equal(parseFaId(`fa2027-${'a'.repeat(60)}`), null);
  assert.equal(parseFaId('spo1-2026-10-17-lg-kia'), null);
});

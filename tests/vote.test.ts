import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGameId, startsAt, isOpen, isVisible, sha256 } from '../api/_vote.ts';

test('경기 id: 형식·팀 id 검사', () => {
  assert.deepEqual(parseGameId('spo2-2026-10-18-lg-kia')?.teams, ['lg', 'kia']);
  assert.equal(parseGameId('spo2-2026-10-18-lg-lg'), null);
  assert.equal(parseGameId('spo2-2026-10-18-lg-xyz'), null);
  assert.equal(parseGameId('x1-2026-10-18-lg-kia'), null);
  assert.equal(parseGameId(42), null);
});
test('마감: 토·일 14:00, 평일 18:30(한국 시간), 7일 전부터 열림', () => {
  assert.equal(new Date(startsAt('2026-10-18')).toISOString(), '2026-10-18T05:00:00.000Z'); // 일 14:00 KST
  assert.equal(new Date(startsAt('2026-10-20')).toISOString(), '2026-10-20T09:30:00.000Z'); // 화 18:30 KST
  const g = parseGameId('spo2-2026-10-18-lg-kia')!;
  assert.equal(isOpen(g, Date.parse('2026-10-18T04:59:00Z')), true);
  assert.equal(isOpen(g, Date.parse('2026-10-18T05:00:00Z')), false);
  assert.equal(isOpen(g, Date.parse('2026-10-10T00:00:00Z')), false);
  assert.equal(isVisible(g, Date.parse('2026-10-25T00:00:00Z')), true);
});
test('IP 해시: 원문이 남지 않고 같은 입력엔 같은 값', async () => {
  const a = await sha256('s:g:1.2.3.4');
  assert.equal(a, await sha256('s:g:1.2.3.4'));
  assert.ok(!a.includes('1.2.3.4'));
  assert.equal(a.length, 32);
});

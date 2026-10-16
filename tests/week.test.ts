import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueIdOf, mondayOfWeekId, periodOfIssue, previousWeekIds, addWeeks } from '../src/lib/week.ts';

test('KST 월요일 06:40은 해당 ISO 주차', () => {
  // 2026-10-19 06:40 KST = 2026-10-18 21:40 UTC → W43
  assert.equal(issueIdOf(new Date('2026-10-18T21:40:00Z')), '2026-W43');
});
test('일요일 밤(KST)은 아직 이전 주차', () => {
  assert.equal(issueIdOf(new Date('2026-10-18T14:59:00Z')), '2026-W42'); // 일 23:59 KST
});
test('주차 → 월요일, 수집 기간', () => {
  assert.equal(mondayOfWeekId('2026-W43'), '2026-10-19');
  assert.deepEqual(periodOfIssue('2026-W43'), { start: '2026-10-12', end: '2026-10-18' });
});
test('연도 경계', () => {
  assert.equal(mondayOfWeekId('2026-W01'), '2025-12-29');
  assert.equal(addWeeks('2026-W01', -1), '2025-W52');
  assert.deepEqual(previousWeekIds('2026-W02', 2), ['2026-W01', '2025-W52']);
});

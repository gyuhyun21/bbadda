import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daily } from '../scripts/push-daily.ts';
import { parseMsg } from '../api/_push.ts';

const sig = (team: string, brief: string, hot: number, at = '2026-10-24T00:00:00Z') => ({ team, brief_ko: brief, collected_at: at, scores: { hot } });

test('경기 없는 날: 오늘 한 줄 3개, 같은 팀은 한 번, 알림 형식 통과', () => {
  const m = daily([sig('kia', 'A', 90), sig('kia', 'B', 80), sig('lg', 'C', 70), sig('kt', 'D', 60), sig('nc', '어제', 99, '2026-10-22T00:00:00Z')], undefined, undefined, '2026-10-24');
  assert.equal(m?.body, '① A\n② C\n③ D');
  assert.ok(parseMsg(m));
});

test('경기 있는 날: 경기 안내', () => {
  const g = { date: '2026-10-25', time: '14:00', no: 1, sides: [{ id: 'kia' }, { id: 'samsung' }] } as never;
  const m = daily([], g, 'PO', '2026-10-25');
  assert.equal(m?.title, '오늘 14:00 PO 1차전, 승리팀을 맞춰라!');
  assert.ok(m?.body.startsWith('KIA vs 삼성'));
});

test('소식이 없으면 보내지 않음', () => assert.equal(daily([], undefined, undefined, '2026-10-24'), null));

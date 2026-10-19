import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindAt } from '../scripts/insta/build.ts';

test('인스타 세트 시간대: 평일 12·20시, 주말 10·16시', () => {
  assert.equal(kindAt(1, 7), 'morning');
  assert.equal(kindAt(2, 16), 'pregame');
  assert.equal(kindAt(3, 22), 'postgame');
  assert.equal(kindAt(6, 12), 'pregame');
  assert.equal(kindAt(0, 18), 'postgame');
});

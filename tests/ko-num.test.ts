import { test } from 'node:test';
import assert from 'node:assert/strict';
import { koNum, sino, native } from '../scripts/insta/ko-num.ts';

test('한자어·고유어 수', () => {
  assert.equal(sino(24), '이십사'); assert.equal(sino(2024), '이천이십사'); assert.equal(sino(10), '십'); assert.equal(sino(110000), '십일만');
  assert.equal(native(2), '두'); assert.equal(native(20), '스무'); assert.equal(native(21), '스물한');
});

test('대본 숫자 → 읽는 소리(docs/insta-style.md 10절)', () => {
  const cases: [string, string][] = [
    ['3경기 합계 24 대 5야.', '세 경기 합계 이십사 대 오야.'],
    ['13-1로 끝났지', '십삼 대 일로 끝났지'],
    ['내일 오후 2시, 대구.', '내일 오후 두 시, 대구.'],
    ['6시 30분 시작', '여섯 시 삼십분 시작'],
    ['플레이오프 1차전', '플레이오프 일차전'],
    ['평균자책 7.71인데 9K', '평균자책 칠 점 칠일인데 삼진 아홉 개'],
    ['진출 확률 78%', '진출 확률 칠십팔 퍼센트'],
    ['2024년 10월 25일', '이천이십사년 시월 이십오일'],
    ['6회에 멈췄어', '육회에 멈췄어'],
    ['3년 34억 재계약', '삼년 삼십사억 재계약'],
    ['20경기 연속', '스무 경기 연속'],
    ['3번 타자', '삼번 타자'],
    ['2시즌 연속', '이시즌 연속'],
  ];
  for (const [i, o] of cases) assert.equal(koNum(i), o, i);
  for (const [i] of cases) assert.ok(!/\d/.test(koNum(i)));
});

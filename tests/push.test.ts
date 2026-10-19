import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSub, parseMsg, safeEqual } from '../api/_push.ts';
import { messages } from '../scripts/push-message.ts';
import { loadPostseason, resolvePostseason } from '../src/lib/postseason.ts';

test('구독 정보·메시지 검사', () => {
  assert.ok(parseSub({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BNc_x-1', auth: 'a1_b' } }));
  assert.equal(parseSub({ endpoint: 'http://x.com', keys: { p256dh: 'a', auth: 'b' } }), null);
  assert.equal(parseSub({ endpoint: 'https://x.com', keys: { p256dh: 'a b', auth: 'b' } }), null);
  assert.ok(parseMsg({ title: '준PO 3차전 결과', body: 'KIA 5-3 LG', url: '/' }));
  assert.equal(parseMsg({ title: 't', body: 'b', url: 'https://evil.com' }), null);
  assert.equal(parseMsg({ title: 't', body: 'b', url: '//evil.com' }), null);
  assert.ok(safeEqual('Bearer a', 'Bearer a'));
  assert.ok(!safeEqual('Bearer a', 'Bearer b'));
});

test('알림 문구: 새로 채워진 결과·예고 선발만', () => {
  const d = loadPostseason('tests/fixtures')!;
  const prev = structuredClone(d);
  const cur = structuredClone(d);
  const spo = cur.rounds.find((r) => r.id === 'spo')!;
  const g2 = spo.games.find((g) => g.no === 2)!;
  g2.result = { kia: 6, lg: 3 } as never;
  const today = '2026-10-19';
  const msgs = messages(resolvePostseason(prev, today).rounds, resolvePostseason(cur, today).rounds);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].title, '준PO 2차전 결과');
  assert.match(msgs[0].body, /^KIA 6-3 LG · 시리즈 /);
  assert.deepEqual(messages(resolvePostseason(cur, today).rounds, resolvePostseason(cur, today).rounds), []);
});

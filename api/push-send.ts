// 경기 알림 발송(Vercel 함수). GitHub Actions(.github/workflows/push.yml)가 경기 결과·예고 선발이 갱신될 때 부른다.
//   POST /api/push-send  Authorization: Bearer <PUSH_SECRET>  { title, body, url, tag? } → 모든 구독자에게 발송
// 환경변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(선택, 기본 https://bbadda.com), PUSH_SECRET
import webpush from 'web-push';
import { parseMsg, safeEqual, type PushSub } from './_push.js';
import { redis, redisReady, json } from './_redis.js';

export const config = { maxDuration: 60 };

export async function POST(request: Request) {
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, PUSH_SECRET: secret } = process.env;
  if (!pub || !priv || !secret || !redisReady()) return json({ error: 'not configured' }, 503);
  if (!safeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return json({ error: 'unauthorized' }, 401);
  let msg;
  try { msg = parseMsg(await request.json()); } catch { msg = null; }
  if (!msg) return json({ error: 'bad message' }, 400);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://bbadda.com', pub, priv);
  const [all] = await redis([['HGETALL', 'push:subs']]);
  const flat = (all.result as string[]) ?? [];
  const payload = JSON.stringify(msg);
  let sent = 0, failed = 0;
  const gone: string[] = [];
  // ponytail: 50개씩 동시 발송. 구독자가 수천 명을 넘어 60초 안에 못 끝나면 큐 방식으로 바꾼다
  for (let i = 0; i < flat.length; i += 100) {
    const batch = [];
    for (let j = i; j < Math.min(i + 100, flat.length); j += 2) batch.push([flat[j], JSON.parse(flat[j + 1]) as PushSub] as const);
    const res = await Promise.allSettled(batch.map(([, sub]) => webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'normal' })));
    res.forEach((r, k) => {
      if (r.status === 'fulfilled') sent++;
      else { failed++; const code = (r.reason as { statusCode?: number })?.statusCode; if (code === 404 || code === 410) gone.push(batch[k][0]); }
    });
  }
  if (gone.length) await redis([['HDEL', 'push:subs', ...gone]]);
  return json({ sent, failed, removed: gone.length });
}

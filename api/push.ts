// 경기 알림 구독(Vercel 함수). 저장소: Upstash Redis 해시 push:subs (필드 = 구독 주소 해시, 값 = 구독 정보).
//   GET    /api/push                 → { publicKey }  (VAPID 공개 키, 설정 안 됐으면 503)
//   POST   /api/push { subscription } → 저장
//   DELETE /api/push { endpoint }     → 삭제
// 환경변수: VAPID_PUBLIC_KEY (+ 발송용 VAPID_PRIVATE_KEY, PUSH_SECRET 는 api/push-send.ts)
import { parseSub } from './_push.js';
import { sha256 } from './_vote.js';
import { redis, redisReady, json } from './_redis.js';

const MAX_SUBS = 20000; // ponytail: 무료 Redis 용량 보호용 상한. 넘으면 새 구독을 받지 않는다

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey || !redisReady()) return json({ error: 'not configured' }, 503);
  return json({ publicKey });
}

export async function POST(request: Request) {
  if (!redisReady()) return json({ error: 'not configured' }, 503);
  let body: { subscription?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const sub = parseSub(body.subscription);
  if (!sub) return json({ error: 'bad subscription' }, 400);
  const [n] = await redis([['HLEN', 'push:subs']]);
  if (Number(n.result) >= MAX_SUBS) return json({ error: 'full' }, 503);
  await redis([['HSET', 'push:subs', await sha256(sub.endpoint), JSON.stringify(sub)]]);
  return json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!redisReady()) return json({ error: 'not configured' }, 503);
  let body: { endpoint?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  if (typeof body.endpoint !== 'string' || body.endpoint.length > 1000) return json({ error: 'bad endpoint' }, 400);
  await redis([['HDEL', 'push:subs', await sha256(body.endpoint)]]);
  return json({ ok: true });
}

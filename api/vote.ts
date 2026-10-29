// 승부 예측 투표 API(Vercel 함수). 저장소: Upstash Redis(Vercel Marketplace 연동, 무료 사용량).
//   GET  /api/vote?game=<id>          → { counts: {팀: 수}, open }
//   POST /api/vote { game, team }     → 한 IP 한 경기 1표(IP 원문은 저장하지 않고 해시만, 경기 30일 뒤 삭제)
//   FA 행선지 투표도 같은 주소: game=fa<시즌>-<선수>(api/_vote.ts parseFaId), 한 IP 한 선수 1표, 누적.
// 환경변수(연동이 자동으로 넣는다): KV_REST_API_URL + KV_REST_API_TOKEN (또는 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). VOTE_SALT(선택).
import { parseGameId, parseFaId, FA_TTL, isOpen, isVisible, startsAt, sha256 } from './_vote.js';
import { redis, redisReady, json } from './_redis.js';

async function counts(id: string, teams: string[]) {
  const [r] = await redis([['HMGET', `vote:${id}`, ...teams]]);
  const v = (r.result as (string | null)[]) ?? [];
  return Object.fromEntries(teams.map((t, i) => [t, Number(v[i] ?? 0)]));
}

// 경기 투표(기간 있음) 또는 FA 투표(늘 열림)
function target(id: unknown, now: number) {
  const g = parseGameId(id);
  if (g) return { id: g.id, teams: g.teams as string[], visible: isVisible(g, now), open: isOpen(g, now), ttl: Math.ceil((startsAt(g.date) + 30 * 86400_000 - now) / 1000) };
  const f = parseFaId(id);
  return f && { ...f, visible: true, open: true, ttl: FA_TTL };
}

export async function GET(request: Request) {
  if (!redisReady()) return json({ error: 'not configured' }, 503);
  const g = target(new URL(request.url).searchParams.get('game'), Date.now());
  if (!g || !g.visible) return json({ error: 'bad game' }, 400);
  return json({ counts: await counts(g.id, g.teams), open: g.open });
}

export async function POST(request: Request) {
  if (!redisReady()) return json({ error: 'not configured' }, 503);
  let body: { game?: unknown; team?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const g = target(body.game, Date.now());
  if (!g || typeof body.team !== 'string' || !g.teams.includes(body.team)) return json({ error: 'bad vote' }, 400);
  if (!g.open) return json({ error: 'closed', counts: await counts(g.id, g.teams), open: false }, 409);
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const who = await sha256(`${process.env.VOTE_SALT ?? 'bbadda'}:${g.id}:${ip}`);
  const [first] = await redis([['SET', `vote:${g.id}:who:${who}`, body.team, 'NX', 'EX', g.ttl]]);
  if (first.result === 'OK') await redis([['HINCRBY', `vote:${g.id}`, body.team, 1], ['EXPIRE', `vote:${g.id}`, g.ttl]]);
  return json({ counts: await counts(g.id, g.teams), open: true, duplicate: first.result !== 'OK' });
}

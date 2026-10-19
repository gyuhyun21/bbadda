// Upstash Redis REST(Vercel Marketplace 연동). '_' 로 시작해 Vercel 함수로 배포되지 않는다.
// 환경변수(연동이 자동으로 넣는다): KV_REST_API_URL + KV_REST_API_TOKEN (또는 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
export const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
export const redisReady = () => !!(REDIS_URL && TOKEN);

export async function redis(cmds: (string | number)[][]): Promise<{ result: unknown }[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmds) });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return res.json();
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

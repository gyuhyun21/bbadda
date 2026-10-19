// 경기 알림(웹 푸시)의 순수 로직(테스트 가능). '_' 로 시작해 Vercel 함수로 배포되지 않는다.
export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
const b64url = /^[A-Za-z0-9_-]+={0,2}$/;

/** 브라우저가 준 구독 정보 검사: https 주소, 키 형식, 길이 제한 */
export function parseSub(x: unknown): PushSub | null {
  const s = x as PushSub;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000 || !s.keys) return null;
  try { if (new URL(s.endpoint).protocol !== 'https:') return null; } catch { return null; }
  const { p256dh, auth } = s.keys;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100 || !b64url.test(p256dh) || !b64url.test(auth)) return null;
  return { endpoint: s.endpoint, keys: { p256dh, auth } };
}

export type PushMsg = { title: string; body: string; url: string; tag?: string };
/** 발송 메시지 검사: 짧은 글자, 사이트 안 주소('/'로 시작)만 */
export function parseMsg(x: unknown): PushMsg | null {
  const m = x as PushMsg;
  if (!m || typeof m.title !== 'string' || typeof m.body !== 'string' || typeof m.url !== 'string') return null;
  if (!m.title || m.title.length > 60 || m.body.length > 160 || !/^\/(?!\/)/.test(m.url) || m.url.length > 200) return null;
  return { title: m.title, body: m.body, url: m.url, ...(typeof m.tag === 'string' && m.tag.length <= 60 ? { tag: m.tag } : {}) };
}

/** 길이가 같을 때만 비교하는 상수 시간 비교 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// 승부 예측 투표의 순수 로직(테스트 가능). '_' 로 시작해 Vercel 함수로 배포되지 않는다.
// 경기 id: <라운드><차전>-<YYYY-MM-DD>-<팀a>-<팀b>  예) spo1-2026-10-17-lg-kia  (화면이 data/postseason.yaml 로 만든다)
// 마감: 경기 시작 시각(평일 18:30, 토·일 14:00, 한국 시간) — data/postseason.yaml 의 time 규칙과 같다.

export const TEAM_IDS = ['lg', 'hanwha', 'ssg', 'samsung', 'nc', 'kt', 'lotte', 'kia', 'doosan', 'kiwoom'];

export type GameId = { id: string; date: string; teams: [string, string] };

export function parseGameId(id: unknown): GameId | null {
  if (typeof id !== 'string') return null;
  const m = /^(wc|spo|po|ks)([1-7])-(\d{4}-\d{2}-\d{2})-([a-z]+)-([a-z]+)$/.exec(id);
  if (!m) return null;
  const [, , , date, a, b] = m;
  if (a === b || !TEAM_IDS.includes(a) || !TEAM_IDS.includes(b) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  return { id, date, teams: [a, b] };
}

/** 경기 시작 시각(UTC ms) */
export function startsAt(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const hm = day === 0 || day === 6 ? '14:00' : '18:30';
  return Date.parse(`${date}T${hm}:00+09:00`);
}

/** 투표 가능: 경기 시작 전, 그리고 경기 7일 전부터(엉뚱한 id 로 키가 쌓이지 않게) */
export function isOpen(g: GameId, now: number): boolean {
  const s = startsAt(g.date);
  return now < s && now > s - 7 * 86400_000;
}

/** 결과를 볼 수 있는 기간: 경기 7일 전 ~ 경기 30일 뒤 */
export function isVisible(g: GameId, now: number): boolean {
  const s = startsAt(g.date);
  return now > s - 7 * 86400_000 && now < s + 30 * 86400_000;
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

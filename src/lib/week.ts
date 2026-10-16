// ISO 주차 계산 (KST 기준). 호(issue) = 발행일이 속한 ISO 주차, 수집 기간 = 직전 월~일.
const KST_MS = 9 * 3600 * 1000;
const DAY = 86400000;

const shifted = (d: Date) => new Date(d.getTime() + KST_MS);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, '0');

export function toKstDate(d: Date): string {
  return ymd(shifted(d));
}

export function isoWeekOf(d: Date): { year: number; week: number } {
  const k = shifted(d);
  const t = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return { year, week };
}

export function issueIdOf(d: Date): string {
  const { year, week } = isoWeekOf(d);
  return `${year}-W${pad(week)}`;
}

/** 'YYYY-Www' → 그 주 월요일 (YYYY-MM-DD) */
export function mondayOfWeekId(id: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!m) throw new Error(`잘못된 주차: ${id}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday1 = jan4.getTime() - (dow - 1) * DAY;
  return ymd(new Date(monday1 + (week - 1) * 7 * DAY));
}

export function addWeeks(id: string, n: number): string {
  const monday = new Date(mondayOfWeekId(id) + 'T00:00:00Z');
  return issueIdOf(new Date(monday.getTime() + n * 7 * DAY - KST_MS + 12 * 3600 * 1000));
}

export function previousWeekIds(id: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addWeeks(id, -(i + 1)));
}

/** 발행 주차(id)의 수집 기간: 직전 월 00:00 ~ 일 23:59 (KST) */
export function periodOfIssue(id: string): { start: string; end: string } {
  const monday = new Date(mondayOfWeekId(id) + 'T00:00:00Z').getTime();
  return { start: ymd(new Date(monday - 7 * DAY)), end: ymd(new Date(monday - DAY)) };
}

export function currentIssueId(now = new Date()): string {
  return issueIdOf(now);
}

/** 이번 실행이 모으는 호: 월요일 06시(KST) 전이면 이번 주 월요일 발행 호(지난주 소식), 그 뒤면 다음 월요일 발행 호. */
export function collectingIssueId(now = new Date()): string {
  return issueIdOf(new Date(now.getTime() + 7 * DAY - 6 * 3600 * 1000));
}

// npm run validate — 설정·콘텐츠 스키마와 편집 규칙 검사. 하나라도 위반이면 exit 1.
import { basename, dirname, relative } from 'node:path';
import { loadTeams } from '../src/lib/config.ts';
import { readJsonDir, readMarkdownDir, contentDir } from '../src/lib/fsdata.ts';
import { signalSchema, columnSchema, type Signal } from '../src/lib/schemas.ts';

export const MAX_QUOTE_WORDS = 15;

export type Report = { errors: string[]; warnings: string[]; counts: Record<string, number> };

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const sentenceCount = (s: string) => s.split(/(?<=[.!?。！？])\s+|(?<=다\.)\s*/).filter((x) => x.trim()).length;

/** 본문에서 따옴표·인용 블록 발췌를 찾아 15단어 초과인 것을 돌려준다 */
export function longQuotes(body: string): string[] {
  const found: string[] = [];
  for (const m of body.matchAll(/[“"「『]([^”"」』\n]{1,400})[”"」』]/g)) found.push(m[1]);
  for (const line of body.split('\n')) if (/^>\s?/.test(line)) found.push(line.replace(/^>\s?/, ''));
  return found.filter((q) => wordCount(q) > MAX_QUOTE_WORDS);
}

const schemaMsg = (e: { issues: { path: PropertyKey[]; message: string }[] }) => '스키마 오류 — ' + e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');

/** 신호 하나의 편집 규칙 검사(스키마 통과 후). 오류 메시지 목록. */
export function checkSignal(s: Signal, teamIds: Set<string>): string[] {
  const out: string[] = [];
  for (const t of [...s.teams, ...(s.team ? [s.team] : [])]) if (!teamIds.has(t)) out.push(`없는 팀 id: ${t}`);
  if (s.team && !s.teams.includes(s.team)) out.push('team 은 teams 에도 있어야 합니다');
  if ((s.module === 'team' || s.module === 'fans') && !s.team) out.push(`module=${s.module} 에는 team 이 필요합니다`);
  if (s.module === 'rivalry' && s.teams.length < 2) out.push('module=rivalry 는 팀이 2개 이상이어야 합니다');
  if (s.summary_ko && sentenceCount(s.summary_ko) > 2) out.push('summary_ko 는 2문장 이내여야 합니다');
  if (s.excerpt && wordCount(s.excerpt.replace(/…$/, '')) > MAX_QUOTE_WORDS) out.push(`excerpt 가 ${MAX_QUOTE_WORDS}단어를 넘습니다`);
  if (s.quote && wordCount(s.quote) > MAX_QUOTE_WORDS) out.push(`quote 가 ${MAX_QUOTE_WORDS}단어를 넘습니다`);
  if (s.quote && !/\s/.test(s.quote) && s.quote.length > 40) out.push('quote 가 너무 깁니다');
  return out;
}

export function validateAll(root: string): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rel = (f: string) => relative(root, f);
  const err = (f: string, msg: string) => errors.push(`${rel(f)}: ${msg}`);

  let teamIds = new Set<string>();
  try { teamIds = new Set(loadTeams().teams.map((t) => t.id)); } catch (e) { errors.push(String((e as Error).message)); }

  // ── signals
  const signals = new Map<string, Signal>();
  for (const { file, data } of readJsonDir(contentDir(root, 'signals'))) {
    const p = signalSchema.safeParse(data);
    if (!p.success) { err(file, schemaMsg(p.error)); continue; }
    const s = p.data;
    if (signals.has(s.id)) err(file, `signal id 중복: ${s.id}`);
    signals.set(s.id, s);
    if (basename(dirname(file)) !== s.issue) err(file, `폴더와 issue(${s.issue})가 다릅니다`);
    for (const m of checkSignal(s, teamIds)) err(file, m);
  }
  const needSummary = (id: string, owner: string, file: string) => {
    const s = signals.get(id);
    if (!s) return err(file, `${owner}: 없는 signal id "${id}"`);
    if (!s.summary_ko.trim()) err(file, `${owner}: signal "${id}" 의 summary_ko 가 비어 있습니다(인용되는 signal 은 요약 필수)`);
  };
  // ── columns
  const columns = readMarkdownDir(contentDir(root, 'columns'));
  for (const { file, data, body = '' } of columns) {
    const p = columnSchema.safeParse(data);
    if (!p.success) { err(file, schemaMsg(p.error)); continue; }
    const c = p.data;
    if (JSON.stringify(data).includes('TODO') || body.includes('TODO')) err(file, 'TODO 가 남아 있습니다');
    if (c.team && !teamIds.has(c.team)) err(file, `없는 팀 id ${c.team}`);
    c.evidence.forEach((id) => needSummary(id, 'evidence', file));
    for (const q of longQuotes(body)) err(file, `인용이 ${MAX_QUOTE_WORDS}단어를 넘습니다: "${q.slice(0, 30)}…"`);
  }

  const sampleCount = [...signals.values()].filter((s) => s.sample).length;
  if (sampleCount > 0 && sampleCount < signals.size) warnings.push('샘플 데이터와 실데이터가 섞여 있습니다.');

  return { errors, warnings, counts: { signals: signals.size, columns: columns.length } };
}

if (process.argv[1] && /validate\.ts$/.test(process.argv[1])) {
  const r = validateAll(process.cwd());
  r.warnings.forEach((w) => console.warn('⚠ ' + w));
  if (r.errors.length) {
    r.errors.forEach((e) => console.error('✖ ' + e));
    console.error(`\nvalidate 실패: 오류 ${r.errors.length}건`);
    process.exit(1);
  }
  console.log(`validate 통과 — signals ${r.counts.signals}, columns ${r.counts.columns}`);
}

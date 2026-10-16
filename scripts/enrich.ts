// npm run enrich [-- --week=YYYY-Www] — 요약을 쓴 뉴스에 원 기사 주소·대표 이미지 주소를 채운다. 매일 갱신 루틴에서 요약 뒤에 실행.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadSources } from '../src/lib/config.ts';
import { collectingIssueId } from '../src/lib/week.ts';
import { readJsonDir, contentDir } from '../src/lib/fsdata.ts';
import { signalSchema, type Signal } from '../src/lib/schemas.ts';
import { enrichSignals } from './collect/enrich.ts';
import { makeFetcher } from './collect/index.ts';

const week = process.argv.find((a) => a.startsWith('--week='))?.slice(7) ?? collectingIssueId();
const files = readJsonDir(join(contentDir(ROOT, 'signals'), week)).flatMap((l) => {
  const p = signalSchema.safeParse(l.data);
  return p.success ? [{ file: l.file, raw: JSON.parse(readFileSync(l.file, 'utf8')) as Record<string, unknown>, s: p.data }] : [];
});
const sources = loadSources();
const ctx = { now: new Date(), fetchText: makeFetcher(sources.http), log: (m: string) => console.log('  ' + m), env: process.env };
const { signals, log } = await enrichSignals(ctx, files.map((f) => f.s), sources.enrich);
const byId = new Map<string, Signal>(signals.map((s) => [s.id, s]));
let changed = 0;
for (const f of files) {
  const s = byId.get(f.s.id)!;
  if (s.url === f.s.url && s.image === f.s.image) continue;
  // 요약 등 다른 필드는 그대로 두고 url·image 만 바꾼다
  writeFileSync(f.file, JSON.stringify({ ...f.raw, url: s.url, ...(s.image ? { image: s.image } : {}) }, null, 2) + '\n');
  changed++;
}
console.log(`enrich ${week}: 대상 신호 ${files.length}건 중 ${changed}건 갱신`, JSON.stringify(log));

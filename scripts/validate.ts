// npm run validate — 설정·콘텐츠 검사. 하나라도 위반이면 exit 1.
import { loadTeams } from '../src/lib/config.ts';

export type Report = { errors: string[]; warnings: string[] };

export function validateAll(_root: string): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  try { loadTeams(); } catch (e) { errors.push(String((e as Error).message)); }
  return { errors, warnings };
}

if (process.argv[1] && /validate\.ts$/.test(process.argv[1])) {
  const r = validateAll(process.cwd());
  r.warnings.forEach((w) => console.warn('⚠ ' + w));
  if (r.errors.length) {
    r.errors.forEach((e) => console.error('✖ ' + e));
    console.error(`\nvalidate 실패: 오류 ${r.errors.length}건`);
    process.exit(1);
  }
  console.log('validate 통과');
}

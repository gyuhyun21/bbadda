import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { validateAll, longQuotes } from '../scripts/validate.ts';
import { collectingIssueId } from '../src/lib/week.ts';

const sig = (id: string, over: Record<string, unknown> = {}) => ({
  id, issue: '2026-W43', module: 'team', team: 'lg', teams: ['lg'],
  source_type: 'news', source_name: '테스트일보', url: `https://example.com/${id}`, title: `LG 트윈스 제목 ${id}`, title_ko: undefined,
  published_at: '2026-10-14T00:00:00+09:00', collected_at: '2026-10-19T05:07:00+09:00',
  summary_ko: '요약 한 문장입니다.', metrics: {}, scores: { hot: 50, relevance: 40 }, sentiment: 'neutral', ...over,
});
function setup(opts: { signals?: Record<string, unknown>[]; column?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bbadda-'));
  const sdir = join(root, 'src/content/signals/2026-W43');
  mkdirSync(sdir, { recursive: true });
  for (const s of opts.signals ?? [sig('a'), sig('b')]) writeFileSync(join(sdir, `${s.id}.json`), JSON.stringify(s));
  if (opts.column) {
    mkdirSync(join(root, 'src/content/columns'), { recursive: true });
    writeFileSync(join(root, 'src/content/columns', 'c.md'), opts.column);
  }
  return root;
}
const has = (r: { errors: string[] }, s: string) => assert.ok(r.errors.some((e) => e.includes(s)), r.errors.join('\n') || '(오류 없음)');

test('정상 데이터는 통과', () => assert.deepEqual(validateAll(setup()).errors, []));
test('없는 팀 id 는 실패', () => has(validateAll(setup({ signals: [sig('a', { team: 'xx', teams: ['xx'] })] })), '없는 팀 id'));
test('팀 소식에 team 이 없으면 실패', () => has(validateAll(setup({ signals: [sig('a', { team: undefined, teams: [] })] })), 'team 이 필요'));
test('라이벌 모듈은 2팀 이상', () => has(validateAll(setup({ signals: [sig('a', { module: 'rivalry' })] })), '2개 이상'));
test('리그 소식은 팀 없이도 통과', () => assert.deepEqual(validateAll(setup({ signals: [sig('a', { module: 'league', team: undefined, teams: [] })] })).errors, []));
test('excerpt 15단어 초과는 실패', () => has(validateAll(setup({ signals: [sig('a', { excerpt: Array(16).fill('단어').join(' ') })] })), 'excerpt'));
test('summary_ko 3문장은 실패', () => has(validateAll(setup({ signals: [sig('a', { summary_ko: '하나. 둘. 셋.' })] })), '2문장'));
test('폴더와 issue 가 다르면 실패', () => has(validateAll(setup({ signals: [sig('a', { issue: '2026-W44' })] })), '폴더'));
test('네이버 주소도 다른 출처와 똑같이 통과(저장소 주인 결정)', () => assert.deepEqual(validateAll(setup({ signals: [sig('a', { url: 'https://m.sports.naver.com/kbaseball/article/1' })] })).errors, []));
test('긴 인용 찾기', () => {
  assert.equal(longQuotes(`"${Array(16).fill('a').join(' ')}"`).length, 1);
  assert.equal(longQuotes('"짧은 인용"').length, 0);
});
test('모으는 호: 월 05:07 은 이번 주 호, 월 06:37·화요일은 다음 주 호', () => {
  assert.equal(collectingIssueId(new Date('2026-10-19T05:07:00+09:00')), '2026-W43');
  assert.equal(collectingIssueId(new Date('2026-10-19T06:37:00+09:00')), '2026-W44');
  assert.equal(collectingIssueId(new Date('2026-10-20T06:37:00+09:00')), '2026-W44');
  assert.equal(collectingIssueId(new Date('2026-10-26T05:07:00+09:00')), '2026-W44');
});
test('칼럼: 근거 signal 은 요약이 있어야 하고 TODO 가 없어야 함', () => {
  const col = (front: Record<string, unknown>, body = '본문') => `---\n${stringify({ title: 't', published_at: '2026-10-16', evidence: ['a'], status: 'published', ...front })}---\n${body}\n`;
  assert.deepEqual(validateAll(setup({ column: col({}) })).errors, []);
  has(validateAll(setup({ signals: [sig('a', { summary_ko: '' })], column: col({}) })), 'summary_ko');
  has(validateAll(setup({ column: col({}, 'TODO') })), 'TODO');
});

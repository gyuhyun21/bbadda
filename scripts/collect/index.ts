// npm run collect — 수집 → 팀 판별 → 중복 합치기 → 점수 → 상한 → src/content/signals/<호>/ 저장 + logs/collect-<호>.json
// 옵션: --week=YYYY-Www(기본: 모으는 호, 월 06시 전이면 이번 주 호) · --only=news_rss,youtube · --as-of=<ISO 시각> · --dry
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadScoring, loadSources, loadTeams, ROOT } from '../../src/lib/config.ts';
import { collectingIssueId, periodOfIssue, previousWeekIds } from '../../src/lib/week.ts';
import { readJsonDir, contentDir } from '../../src/lib/fsdata.ts';
import { signalSchema, type Signal } from '../../src/lib/schemas.ts';
import { collectNews } from './news_rss.ts';
import { collectYouTube } from './youtube.ts';
import { collectKakao } from './kakao.ts';
import { collectInstagram } from './instagram.ts';
import { collectVertex } from './vertex.ts';
import { dedupe } from './dedupe.ts';
import { classify, toSignal, type Cfg } from './classify.ts';
import { scoreAll } from './score.ts';
import type { Ctx, RawItem } from './util.ts';

function loadDotEnv(): void {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[2] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function makeFetcher(opts: { user_agent: string; min_interval_ms: number; timeout_ms: number }): Ctx['fetchText'] {
  const last = new Map<string, number>();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return async (url, req = {}) => {
    const host = new URL(url).host;
    const wait = (last.get(host) ?? 0) + opts.min_interval_ms - Date.now();
    if (wait > 0) await sleep(wait);
    for (let attempt = 0; ; attempt++) {
      last.set(host, Date.now());
      try {
        const res = await fetch(url, { method: req.method ?? 'GET', body: req.body, headers: { 'User-Agent': opts.user_agent, Accept: '*/*', ...(req.headers ?? {}) }, signal: AbortSignal.timeout(opts.timeout_ms) });
        if (!res.ok) {
          // 원인 파악용으로 응답 앞부분을 붙인다(키 값은 응답에 없다). 4xx 는 재시도해도 같으므로 바로 실패.
          const snippet = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
          const err = new Error(`HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`);
          if (res.status >= 400 && res.status < 500) (err as Error & { noRetry?: boolean }).noRetry = true;
          throw err;
        }
        return await res.text();
      } catch (e) {
        if (attempt >= 1 || (e as { noRetry?: boolean }).noRetry) throw e; // 네트워크 오류·5xx 는 1회 재시도
        await sleep(opts.min_interval_ms);
      }
    }
  };
}

type SourceRun = { id: string; run: () => Promise<{ items: RawItem[]; failures: unknown[]; skipped?: string } & Record<string, unknown>> };

export async function runPipeline(ctx: Ctx, week: string, history: Signal[], existingThisWeek: Signal[]) {
  const cfg: Cfg = { teams: loadTeams().teams, scoring: loadScoring() };
  const sources = loadSources();
  const log: Record<string, any> = { week, collected_at: ctx.now.toISOString(), sources: {}, failures: [], skipped: [] };
  const raw: RawItem[] = [];
  const runs: SourceRun[] = [
    { id: 'news_rss', run: async () => (sources.news_rss.enabled ? collectNews(ctx) : { items: [], failures: [], skipped: 'disabled' }) },
    { id: 'youtube', run: () => collectYouTube(ctx) },
    { id: 'kakao', run: () => collectKakao(ctx) },
    { id: 'instagram', run: () => collectInstagram(ctx) },
    { id: 'vertex', run: () => collectVertex(ctx, undefined, [...history, ...existingThisWeek].map((x) => x.url)) },
  ];
  for (const s of runs) {
    if (ctx.only?.length && !ctx.only.includes(s.id)) continue;
    const r = await s.run();
    if (r.skipped) { log.skipped.push({ source: s.id, reason: r.skipped }); continue; }
    raw.push(...r.items);
    const { items, failures, skipped, ...extra } = r;
    log.sources[s.id] = { total: items.length, ...extra };
    log.failures.push(...failures.map((f) => ({ source: s.id, error: f })));
  }

  // 스팸 제목 제외(도박·광고 사이트)
  const spam = sources.exclude_title_patterns.map((p) => new RegExp(p, 'i'));
  for (let k = raw.length - 1; k >= 0; k--) if (spam.some((re) => re.test(raw[k].title))) { raw.splice(k, 1); log.excluded_spam = (log.excluded_spam ?? 0) + 1; }

  // 수집 기간: 그 호의 기간 시작(커뮤니티 검색은 lookback 만큼 더 이르게) ~ 지금
  const startMs = Date.parse(`${periodOfIssue(week).start}T00:00:00+09:00`);
  const inWin = raw.filter((i) => { const t = Date.parse(i.published_at); return t >= startMs - (i.lookback_days ?? 0) * 86400_000 && t <= ctx.now.getTime() + 3600_000; });
  log.out_of_window = raw.length - inWin.length;

  // 같은 글이 여러 팀 검색어로 들어왔으면 검색어 팀을 합친다(제목에 팀이 없을 때 라이벌로 볼 수 있게)
  const qt = new Map<string, Set<string>>();
  for (const r of inWin) for (const t of r.query_teams ?? []) (qt.get(r.url) ?? qt.set(r.url, new Set()).get(r.url)!).add(t);
  for (const r of inWin) if (qt.has(r.url)) r.query_teams = [...qt.get(r.url)!];

  // 팀 판별(제목 기준, 없으면 검색어 팀). 팀도 리그도 아닌 글은 버린다 — 중복 제거 전에 해야 리그 검색으로 들어온 같은 기사가 남는다
  const classified = inWin.flatMap((r) => { const c = classify(r, cfg); return c ? [{ r, c }] : []; });
  log.dropped_no_team = inWin.length - classified.length;
  log.team_inferred = classified.filter((x) => x.c.team_inferred).length;
  const byUrl = new Map(classified.map((x) => [x.r.url, x.c]));

  const { kept, droppedExisting, droppedBatch } = dedupe(classified.map((x) => x.r), [...history, ...existingThisWeek]);
  log.dedupe = { dropped_existing: droppedExisting, merged_in_batch: droppedBatch };
  const built = kept.map((k) => ({ ...toSignal(k.raw, byUrl.get(k.raw.url)!, week, ctx.now, cfg), ...(k.also.length ? { also_in: k.also } : {}) }));
  const scored = scoreAll(built, kept, cfg, ctx.now);

  // 실행당 상한: 팀·모듈별, 리그. 이번 실행에서 새로 들어온 것만 센다. 점수 상위만 남긴다.
  const count = new Map<string, number>();
  // 팬 반응은 출처별(YouTube·블로그/카페·커뮤니티·인스타그램)로 따로 센다 — 조회수 없는 커뮤니티 글이 영상에 밀려 다 잘리지 않게(2026-10-17)
  const fanKind = (s: Signal) => (s.source_type === 'community' ? (/^(블로그|다음카페)/.test(s.source_name) ? 'blog' : 'community') : s.source_type);
  const keyOf = (s: Signal) => (s.module === 'league' ? 'league' : s.module === 'fans' ? `${s.team}|fans|${fanKind(s)}` : `${s.team}|${s.module}`);
  const capOf = (s: Signal) => (s.module === 'league' ? sources.max_league_per_run : sources.max_per_team_per_run[s.module]);
  const final = [...scored].sort((a, b) => b.scores.hot + b.scores.relevance - (a.scores.hot + a.scores.relevance)).filter((s) => {
    const n = (count.get(keyOf(s)) ?? 0) + 1;
    count.set(keyOf(s), n);
    const cap = capOf(s);
    return !cap || n <= cap;
  });
  log.dropped_cap = scored.length - final.length;
  const by = (k: keyof Signal) => Object.fromEntries([...final.reduce((m, s) => m.set(String(s[k] ?? '-'), (m.get(String(s[k] ?? '-')) ?? 0) + 1), new Map<string, number>())]);
  log.new_signals = { total: final.length, by_module: by('module'), by_team: by('team'), by_source: by('source_type') };
  return { signals: final, log };
}

async function main() {
  loadDotEnv();
  const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const asOf = arg('as-of');
  const realNow = new Date();
  const now = asOf ? new Date(asOf) : realNow;
  if (!Number.isFinite(now.getTime())) throw new Error(`--as-of 값을 읽을 수 없습니다: ${asOf}`);
  const week = arg('week') ?? collectingIssueId(now);
  const only = arg('only')?.split(',').filter(Boolean);
  const dry = process.argv.includes('--dry');
  const sigDir = (w: string) => join(contentDir(ROOT, 'signals'), w);
  const readWeek = (w: string): Signal[] => readJsonDir(sigDir(w)).flatMap((l) => { const p = signalSchema.safeParse(l.data); return p.success ? [p.data] : []; });
  const ctx: Ctx = { now, fetchText: makeFetcher(loadSources().http), log: (m) => console.log('  ' + m), env: process.env, only, ...(asOf ? { realNow } : {}) };
  console.log(`collect ${week} (기간 ${periodOfIssue(week).start} ~ ${periodOfIssue(week).end})`);
  // 지난 호를 나중에 만들 때는 이미 실린 다음 호들의 글과도 중복을 거른다
  const later = asOf && existsSync(contentDir(ROOT, 'signals')) ? readdirSync(contentDir(ROOT, 'signals')).filter((w) => /^\d{4}-W\d{2}$/.test(w) && w > week).flatMap(readWeek) : [];
  const history = previousWeekIds(week, 4).flatMap(readWeek);
  const { signals, log } = await runPipeline(ctx, week, [...history, ...later], readWeek(week));
  if (asOf) Object.assign(log, { as_of: now.toISOString(), real_run_at: realNow.toISOString() });
  if (!dry) {
    mkdirSync(sigDir(week), { recursive: true });
    for (const s of signals) writeFileSync(join(sigDir(week), `${s.id}.json`), JSON.stringify(s, null, 2) + '\n');
    mkdirSync(join(ROOT, 'logs'), { recursive: true });
    // 매일 실행은 같은 호 로그에 실행 기록을 덧붙인다
    const logFile = join(ROOT, 'logs', `collect-${week}${only?.length ? '-' + only.join('+') : ''}.json`);
    const prev = existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')) : { runs: [] };
    writeFileSync(logFile, JSON.stringify({ runs: [...(prev.runs ?? []), log] }, null, 2) + '\n');
  }
  console.log(JSON.stringify(log, null, 2));
  console.log(dry ? '(dry run: 저장하지 않음)' : `저장: src/content/signals/${week}/ (${signals.length}건), logs/`);
}

if (process.argv[1] && /collect[\\/]index\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error('collect 치명적 오류:', e); process.exit(1); });
}

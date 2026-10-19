// 인스타 카루셀 세트(5장 + 스토리 1장) HTML 만들기. 사이트 데이터만 쓴다(추론 없음). 그림은 .github/workflows/ig-auto.yml 이 크롬으로 찍는다.
// 사용: npx tsx scripts/insta/build.ts <auto|morning|pregame|postgame> <출력 폴더>   (INSTA_DATE 로 날짜 지정 가능)
//   → 출력 폴더에 index.html(?s=1..5, ?s=story)·자산 복사, 표준 출력에 JSON { key, kind, caption } 또는 { skip: 이유 }
// 세트: 아침(10개 구단 한 줄, 루틴이 쓴 brief_ko 6개 구단 이상일 때) / 경기 전(오늘 경기 예고 선발이 있을 때) / 경기 후(오늘 경기 결과가 있을 때)
import { readFileSync, readdirSync, mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadPostseason, resolvePostseason, lastPlayed, type GameView, type RoundView } from '../../src/lib/postseason.ts';
import { loadTeams } from '../../src/lib/config.ts';

type Kind = 'morning' | 'pregame' | 'postgame';
type Sig = { team?: string; source_type: string; brief_ko?: string; collected_at: string; scores: { hot: number } };
const ROOT = process.cwd();
const TEAMS = loadTeams().teams;
const T = new Map(TEAMS.map((t) => [t.id, t]));
const short = (id?: string) => (id ? T.get(id)?.short ?? id : '');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// INSTA_DATE=YYYY-MM-DD 로 지난·다음 날짜 세트를 다시 만들 수 있다(수동 실행·미리보기용)
const kst = new Date(Date.now() + 9 * 3600_000);
const today = process.env.INSTA_DATE && /^\d{4}-\d{2}-\d{2}$/.test(process.env.INSTA_DATE) ? process.env.INSTA_DATE : kst.toISOString().slice(0, 10);
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const wd = (d: string) => '일월화수목금토'[new Date(`${d}T00:00:00Z`).getUTCDay()];

/** 루틴·사이트와 같은 판 경계: 평일 12·20시, 주말 10·16시 */
export function kindAt(day: number, hour: number): Kind {
  const [a, b] = day === 0 || day === 6 ? [10, 16] : [12, 20];
  return hour < a ? 'morning' : hour < b ? 'pregame' : 'postgame';
}

const mascot = (id?: string, cls = '') => (id ? `<img class="${cls}" src="m/${id}.svg" alt="">` : '');
const foot = (left: string, right = 'bbadda.com') => `<div class="foot"><span>${left}</span><span>${right}</span></div>`;
const top = (tag: string, pg: string) => `<div class="top"><span class="tag">${esc(tag)}</span><span class="pg">${pg}</span></div>`;

function morning(): { slides: string[]; story: string; caption: string; key: string } | string {
  const sigs: Sig[] = [];
  for (const w of readdirSync(join(ROOT, 'src/content/signals'))) {
    const dir = join(ROOT, 'src/content/signals', w);
    if (!/^\d{4}-W\d{2}$/.test(w)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('.')) sigs.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  const fresh = sigs.filter((s) => s.brief_ko && s.team && T.has(s.team) && new Date(Date.parse(s.collected_at) + 9 * 3600_000).toISOString().slice(0, 10) === today);
  const best = new Map<string, Sig>();
  for (const s of fresh) if (!best.has(s.team!) || s.scores.hot > best.get(s.team!)!.scores.hot) best.set(s.team!, s);
  if (best.size < 6) return `오늘 한 줄(brief_ko)이 있는 구단 ${best.size}개(6개 미만)`;
  const rows = TEAMS.filter((t) => best.has(t.id)).map((t) => ({ id: t.id, line: best.get(t.id)!.brief_ko! }));
  const hot = [...best.values()].sort((a, b) => b.scores.hot - a.scores.hot)[0];
  const row = (r: { id: string; line: string }) => `<div class="row">${mascot(r.id)}<b>${esc(short(r.id))}</b><span>${esc(r.line)}</span></div>`;
  const chunks = [rows.slice(0, 4), rows.slice(4, 7), rows.slice(7)].filter((c) => c.length);
  const slides = [
    `<section class="s brief hook-light">${top('아침판', '1/5')}<p class="kicker">${md(today)} (${wd(today)}) 오늘 아침 가장 뜨거운 소식</p><h1>${esc(hot.brief_ko!)}</h1><div class="masc-one">${mascot(hot.team)}</div><p class="swipe">10개 구단 한 줄 보기 ›</p>${foot('<span class="logo-chip"><img src="logo.webp" alt=""></span>', '')}</section>`,
    ...chunks.map((c, i) => `<section class="s brief">${top('오늘 아침 구단 소식', `${i + 2}/5`)}<div class="rows">${c.map(row).join('')}</div>${foot('자세한 소식은 bbadda.com')}</section>`),
  ];
  while (slides.length < 4) slides.push(`<section class="s brief">${top('오늘 아침 구단 소식', `${slides.length + 1}/5`)}<p class="sub">나머지 구단은 사이트에서 확인하세요.</p>${foot('bbadda.com')}</section>`);
  slides.push(`<section class="s brief cta-light">${top('빠따닷컴', '5/5')}<h2>MY팀 소식만<br>먼저 보고 싶다면</h2><div class="steps"><p><i>1</i>프로필 링크 bbadda.com</p><p><i>2</i>MY팀 고르기</p><p><i>3</i>알림받기 켜기</p></div>${foot('<span class="logo-chip"><img src="logo.webp" alt=""></span>', '비공식 팬 사이트')}</section>`);
  const caption = `☀️ ${md(today)} 아침, 10개 구단 한 줄\n\n${rows.map((r) => `${short(r.id)} | ${r.line}`).join('\n')}\n\n👉 자세한 소식은 프로필 링크 bbadda.com\n\n#KBO #프로야구 #야구 #야구팬 #빠따닷컴`;
  const story = `<section class="s story brief hook-light"><p class="kicker">${md(today)} 오늘 아침</p><h1>${esc(hot.brief_ko!)}</h1><div class="masc-one">${mascot(hot.team)}</div><div class="sticker">여기에 링크 스티커</div></section>`;
  return { slides, story, caption, key: `${today}-morning` };
}

function gameData() {
  const d = loadPostseason();
  if (!d) return null;
  const view = resolvePostseason(d, today);
  return { view };
}
const nm = (s: GameView['sides'][number]) => (s.id ? short(s.id) : s.label);
const scoreParts = (g: GameView) => { const [a, b] = g.score!.split('-').map(Number); return a >= b ? { w: 0, l: 1, ws: a, ls: b } : { w: 1, l: 0, ws: b, ls: a }; };

function pregame(): ReturnType<typeof morning> {
  const v = gameData()?.view;
  const g = v?.next;
  if (!v || !g || g.date !== today) return '오늘 경기 없음';
  if (!g.record.starters.every(Boolean) || !g.sides.every((s) => s.id)) return '오늘 경기 예고 선발 미확정';
  const r = v.rounds.find((x) => x.id === g.round)!;
  const [a, b] = g.sides;
  const last = lastPlayed(v.rounds);
  const facts = g.record.facts;
  const slides = [
    `<section class="s dark hook">${top('오늘의 가을야구', '1/5')}<p class="kicker">${esc(g.roundName)} ${g.no}차전</p><h1>오늘 ${esc(g.time)}<br>${esc(g.venue)}</h1>${facts[0] ? `<p class="stat-line">${esc(facts[0])}</p>` : ''}<div class="masc">${mascot(a.id)}<span class="vs">vs</span>${mascot(b.id)}</div>${foot('<span class="logo-chip"><img src="logo.webp" alt=""></span>', '<span class="swipe">옆으로 넘겨 보기 ›</span>')}</section>`,
    `<section class="s dark">${top('예고 선발', '2/5')}<h2>${esc(nm(a))} vs ${esc(nm(b))}</h2><div class="vsgrid">${[0, 1].map((i) => `<div class="side">${mascot(g.sides[i].id)}<div class="t">${esc(nm(g.sides[i]))} ${g.sides[i].wins}승</div><div class="lab">선발</div><div class="p">${esc(g.record.starters[i]!)}</div><div class="n">${esc(g.record.starterNotes[i] ?? '')}</div></div>`).join('<div class="v">vs</div>')}</div>${foot(`${esc(r.short)} ${g.no}차전`)}</section>`,
    `<section class="s dark">${top('관전 포인트', '3/5')}<h2>오늘 경기의 판</h2><ul class="facts">${(facts.length ? facts : [`시리즈 ${nm(a)} ${a.wins}승 · ${nm(b)} ${b.wins}승`]).map((f) => `<li>${esc(f)}</li>`).join('')}</ul><p class="series-line">시리즈 <b>${esc(nm(a))} ${a.wins}승</b> · <b>${esc(nm(b))} ${b.wins}승</b> (${r.toWin}선승)</p>${foot('출처: 언론 보도')}</section>`,
    last && last.score ? (() => { const p = scoreParts(last); return `<section class="s dark">${top('지난 경기', '4/5')}<h2>${esc(v.rounds.find((x) => x.id === last.round)!.short)} ${last.no}차전</h2><div class="score">${'<div>' + mascot(last.sides[p.w].id) + `<p>${esc(nm(last.sides[p.w]))}</p><span class="wb">승리</span></div>`}<div class="num">${p.ws}<i>:</i>${p.ls}</div><div class="lose">${mascot(last.sides[p.l].id)}<p>${esc(nm(last.sides[p.l]))}</p></div></div><p class="series-line">${[last.record.win && `승 ${last.record.win}`, last.record.loss && `패 ${last.record.loss}`, last.record.mvp && `MVP ${last.record.mvp}`].filter(Boolean).map((x) => esc(x as string)).join(' · ')}</p>${foot(`${md(last.date)} · ${esc(last.venue)}`)}</section>`; })()
      : `<section class="s dark">${top('시리즈', '4/5')}<h2>${esc(g.roundName)}</h2><p class="series-line">${r.toWin}선승제 · 오늘이 ${g.no}차전</p>${foot(esc(r.short))}</section>`,
    `<section class="s dark cta">${top('승부 예측', '5/5')}<h2>오늘,<br>누가 이길까요?</h2><div class="vote">${[a, b].map((s, i) => `<div style="background:${T.get(s.id!)?.color ?? '#333'}">${mascot(s.id)}${esc(nm(s))} 승</div>`).join('')}</div><div class="links"><p>💬 댓글로 예측 남기기</p><p>🗳️ 투표는 <b>프로필 링크</b> bbadda.com</p><p>🔔 알림받기 켜면 결과를 바로 알려 드려요</p></div>${foot('<span class="logo-chip"><img src="logo.webp" alt=""></span>', 'bbadda.com')}</section>`,
  ];
  const caption = `⚾ 오늘 ${g.time} ${g.venue}, ${g.roundName} ${g.no}차전\n${nm(a)} ${g.record.starters[0]} vs ${nm(b)} ${g.record.starters[1]}\n${facts.map((f) => `· ${f}`).join('\n')}\n\n누가 이길까요? 댓글로 남기거나 프로필 링크에서 승부예측 🗳️\n\n#KBO #가을야구 #${g.roundName.replace(/\s/g, '')} #${T.get(a.id!)?.name.replace(/\s/g, '')} #${T.get(b.id!)?.name.replace(/\s/g, '')} #빠따닷컴`;
  const story = `<section class="s story dark hook"><p class="kicker">${esc(g.roundName)} ${g.no}차전 · 오늘 ${esc(g.time)}</p><h1>${esc(g.record.starters[0]!)}<br>vs ${esc(g.record.starters[1]!)}</h1><div class="masc">${mascot(a.id)}<span class="vs">vs</span>${mascot(b.id)}</div><div class="sticker">여기에 링크 스티커</div></section>`;
  return { slides, story, caption, key: `${today}-pregame-${g.round}${g.no}` };
}

function postgame(): ReturnType<typeof morning> {
  const v = gameData()?.view;
  if (!v) return '포스트시즌 데이터 없음';
  let r: RoundView | undefined; let g: GameView | undefined;
  for (const x of v.rounds) for (const y of x.games) if (y.date === today && y.played && y.score) { r = x; g = y; }
  if (!r || !g || !g.sides.every((s) => s.id)) return '오늘 경기 결과 없음';
  const p = scoreParts(g);
  const W = g.sides[p.w], L = g.sides[p.l];
  const nextRound = r.winner ? v.rounds[v.rounds.indexOf(r) + 1] : undefined;
  const hook = r.winner ? (nextRound ? `${nm(W)},<br><em>${esc(nextRound.short)}</em> 간다` : `${nm(W)},<br><em>우승!</em>`) : `${nm(W)},<br><em>${W.wins}승</em>째`;
  const rec = [['MVP', g.record.mvp], ['승리', g.record.win && `${g.record.win} (${nm(W)})`], ['패전', g.record.loss && `${g.record.loss} (${nm(L)})`], ['세이브', g.record.save && `${g.record.save} (${nm(W)})`]].filter(([, x]) => x) as [string, string][];
  const games = r.games.filter((x) => !x.skipped).slice(0, 5);
  const slides = [
    `<section class="s dark hook">${top(`${r.short} ${g.no}차전 결과`, '1/5')}<h1 class="big">${hook}</h1><p class="stat-line big-score">${p.ws} : ${p.ls}</p><div class="masc">${mascot(W.id)}${mascot(L.id, 'lose')}</div>${foot('<span class="logo-chip"><img src="logo.webp" alt=""></span>', '<span class="swipe">옆으로 넘겨 보기 ›</span>')}</section>`,
    `<section class="s dark">${top('경기 결과', '2/5')}<h2>${esc(g.roundName)} ${g.no}차전</h2><div class="score"><div>${mascot(W.id)}<p>${esc(nm(W))}</p><span class="wb">승리</span></div><div class="num">${p.ws}<i>:</i>${p.ls}</div><div class="lose">${mascot(L.id)}<p>${esc(nm(L))}</p></div></div><div class="meta"><span>${md(g.date)}(${g.weekday})</span><span>${esc(g.venue)}</span>${g.record.attendance ? `<span>${esc(g.record.attendance)}</span>` : ''}</div>${foot(`${esc(r.short)} ${g.no}차전`)}</section>`,
    `<section class="s dark">${top('경기 기록', '3/5')}<h2>오늘의 주인공</h2><dl class="rec">${rec.map(([k, x]) => `<div class="${k === 'MVP' ? 'mvp' : ''}"><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>${g.record.homers.length ? `<p class="series-line">홈런 ${esc(g.record.homers.slice(0, 3).join(', '))}</p>` : ''}${foot('출처: 언론 보도')}</section>`,
    `<section class="s dark">${top(`${r.short} 시리즈`, '4/5')}<h2>${esc(nm(r.sides[0]))} ${r.sides[0].wins}승 · ${esc(nm(r.sides[1]))} ${r.sides[1].wins}승</h2><div class="games">${games.map((x) => `<div class="g${x === r!.next ? ' next' : ''}${!x.played && x !== r!.next ? ' later' : ''}"><b>${x.no}차전</b><span>${Number(x.date.slice(5, 7))}.${Number(x.date.slice(8, 10))} ${esc(x.venue)}</span><span class="r">${x.played && x.score ? (() => { const q = scoreParts(x); return `${esc(nm(x.sides[q.w]))} ${q.ws}-${q.ls}`; })() : x === r!.next ? '다음 경기' : x.ifNeeded ? '미확정' : ''}</span></div>`).join('')}</div>${foot('일정: KBO 발표')}</section>`,
    `<section class="s dark cta">${top(r.next ? '다음 경기 승부 예측' : '빠따닷컴', '5/5')}<h2>${r.next ? `${r.next.no}차전,<br>누가 이길까요?` : '다음 경기도<br>함께해요'}</h2><div class="links"><p>💬 댓글로 예측 남기기</p><p>🎬 하이라이트·기록은 <b>프로필 링크</b></p><p>🔔 알림받기 켜면 결과를 바로 알려 드려요</p></div>${foot('<span class="logo-chip"><img src="logo.webp" alt=""></span>', 'bbadda.com')}</section>`,
  ];
  const caption = `⚾ ${g.roundName} ${g.no}차전 결과\n${nm(W)} ${p.ws}-${p.ls} ${nm(L)}\n${rec.map(([k, x]) => `${k} ${x}`).join(' · ')}\n시리즈 ${nm(r.sides[0])} ${r.sides[0].wins}승 · ${nm(r.sides[1])} ${r.sides[1].wins}승\n\n🎬 하이라이트·기록은 프로필 링크 bbadda.com\n\n#KBO #가을야구 #${g.roundName.replace(/\s/g, '')} #${T.get(W.id!)?.name.replace(/\s/g, '')} #${T.get(L.id!)?.name.replace(/\s/g, '')} #빠따닷컴`;
  const story = `<section class="s story dark hook"><p class="kicker">${esc(g.roundName)} ${g.no}차전 결과</p><h1 class="big">${hook}</h1><p class="stat-line big-score">${p.ws} : ${p.ls}</p><div class="masc">${mascot(W.id)}${mascot(L.id, 'lose')}</div><div class="sticker">여기에 링크 스티커</div></section>`;
  return { slides, story, caption, key: `${today}-postgame-${g.round}${g.no}` };
}

const CSS = readFileSync(join(ROOT, 'scripts/insta/cards.css'), 'utf8');

if (process.argv[1]?.endsWith('build.ts')) {
  const arg = process.argv[2] ?? 'auto';
  const out = process.argv[3] ?? 'insta-out';
  const kind: Kind = arg === 'auto' ? kindAt(kst.getUTCDay(), kst.getUTCHours()) : (arg as Kind);
  const made = kind === 'morning' ? morning() : kind === 'pregame' ? pregame() : postgame();
  if (typeof made === 'string') { console.log(JSON.stringify({ skip: made, kind })); process.exit(0); }
  mkdirSync(join(out, 'm'), { recursive: true });
  for (const t of TEAMS) if (existsSync(join(ROOT, 'public/mascots', `${t.id}.svg`))) copyFileSync(join(ROOT, 'public/mascots', `${t.id}.svg`), join(out, 'm', `${t.id}.svg`));
  copyFileSync(join(ROOT, 'public/brand/bbadda-logo.webp'), join(out, 'logo.webp'));
  copyFileSync(join(ROOT, 'public/fonts/pretendard/PretendardVariable.subset.woff2'), join(out, 'font.woff2'));
  const body = [...made.slides.map((s, i) => s.replace('<section class="s', `<section id="s${i + 1}" class="s`)), made.story.replace('<section class="s', '<section id="sstory" class="s')].join('\n');
  writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}<script>document.getElementById('s'+(new URLSearchParams(location.search).get('s')||'1')).classList.add('on')</script></body></html>`);
  console.log(JSON.stringify({ key: made.key, kind, caption: made.caption }));
}

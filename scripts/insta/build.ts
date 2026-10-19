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
/** 제목: 루틴이 줄바꿈 자리에 넣은 \n 을 살린다(어절 중간에서 끊기지 않게) */
const hl = (s: string) => esc(s).replace(/\n/g, '<br>');
const flat = (s: string) => s.replace(/\s*\n\s*/g, ' ');
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
const logo = '<span class="logo-chip"><img src="logo.webp" alt=""></span>';
// 첫 장 배경 사진(무료 라이선스, scripts/insta/photos/SOURCES.md). 로고·간판이 읽히지 않게 흐리게 깐다(balls 는 깨끗해서 덜 흐리게). 없으면 그라디언트만
const BLUR: Record<string, number> = { balls: 2 };
const photo = (name: string) => (existsSync(join(ROOT, 'scripts/insta/photos', `${name}.jpg`)) ? ` style="--bg:url(p/${name}.jpg);--blur:${BLUR[name] ?? 12}px" data-photo` : '');

/** 모든 세트의 마지막 장: 빠따닷컴 쓰는 법(접속·홈 화면 추가·알림) */
const guide = `<section class="s guide">${top('빠따닷컴 쓰는 법', '5/5')}<h2>야구 소식,<br>하루 두세 번만 보세요</h2>
<div class="g-steps">
<div><i>1</i><p><b>프로필 링크</b> 누르기<small>bbadda.com · 10개 구단 소식 한 곳에</small></p></div>
<div><i>2</i><p><b>MY팀</b> 고르기<small>우리 팀 소식·선수응원가가 먼저</small></p></div>
<div><i>3</i><p><b>홈 화면에 추가</b><small>아이폰: 사파리 공유 → 홈 화면에 추가 · 안드로이드: 메뉴 → 홈 화면에 추가</small></p></div>
<div><i>4</i><p><b>알림받기</b> 켜기<small>경기 전 예고 선발·경기 후 결과를 바로 알려 드려요</small></p></div>
</div>
<p class="g-note">인스타 안에서 열리면 ⋯ → 외부 브라우저로 열기</p>${foot(logo, '비공식 팬 사이트')}</section>`;

type Made = { slides: string[]; story: string; caption: string; key: string };

function morning(): Made | string {
  const sigs: (Sig & { hook_ko?: string; summary_ko?: string })[] = [];
  for (const w of readdirSync(join(ROOT, 'src/content/signals'))) {
    const dir = join(ROOT, 'src/content/signals', w);
    if (!/^\d{4}-W\d{2}$/.test(w)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('.')) sigs.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  const fresh = sigs.filter((s) => s.brief_ko && s.team && T.has(s.team) && new Date(Date.parse(s.collected_at) + 9 * 3600_000).toISOString().slice(0, 10) === today);
  const best = new Map<string, (typeof fresh)[number]>();
  for (const s of fresh) if (!best.has(s.team!) || s.scores.hot > best.get(s.team!)!.scores.hot) best.set(s.team!, s);
  if (best.size < 6) return `오늘 한 줄(brief_ko)이 있는 구단 ${best.size}개(6개 미만)`;
  const ranked = [...best.values()].sort((a, b) => (b.hook_ko ? 1 : 0) - (a.hook_ko ? 1 : 0) || b.scores.hot - a.scores.hot);
  const lead = ranked[0];
  const tops = ranked.slice(0, 3);
  const rows = TEAMS.filter((t) => best.has(t.id)).map((t) => ({ id: t.id, line: best.get(t.id)!.brief_ko! }));
  const row = (r: { id: string; line: string }) => `<div class="row">${mascot(r.id)}<b>${esc(short(r.id))}</b><span>${esc(r.line)}</span></div>`;
  const half = Math.ceil(rows.length / 2);
  const slides = [
    `<section class="s dark hook"${photo('balls')}>${top('아침판', '1/5')}<p class="kicker">${md(today)} (${wd(today)}) 오늘 아침</p><h1>${hl(lead.hook_ko ?? lead.brief_ko!)}</h1><p class="stat-line">넘기면 10개 구단 소식이 한 줄씩 있어요</p><div class="masc">${mascot(lead.team)}</div>${foot(logo, '<span class="swipe">넘겨서 10개 구단 보기 ›</span>')}</section>`,
    `<section class="s dark">${top('오늘의 큰 소식', '2/5')}<div class="news">${tops.map((x) => `<div class="n-item">${mascot(x.team)}<div><b>${esc(x.brief_ko!)}</b><p>${esc((x.summary_ko ?? '').slice(0, 90))}</p></div></div>`).join('')}</div>${foot('출처: 언론 보도 · 우리 요약')}</section>`,
    `<section class="s brief">${top('10개 구단 한 줄', '3/5')}<div class="rows">${rows.slice(0, half).map(row).join('')}</div>${foot('자세한 소식은 bbadda.com')}</section>`,
    `<section class="s brief">${top('10개 구단 한 줄', '4/5')}<div class="rows">${rows.slice(half).map(row).join('')}</div>${foot('자세한 소식은 bbadda.com')}</section>`,
    guide,
  ];
  const caption = [`☀️ ${flat(lead.hook_ko ?? lead.brief_ko!)}`, '', '오늘 아침 10개 구단 소식, 한 줄로 정리했어요.', '', ...rows.map((r) => `${short(r.id)}  ${r.line}`), '', '우리 팀 소식은 어땠나요? 댓글로 남겨 주세요 👇', '더 자세한 소식은 프로필 링크에서 볼 수 있어요.', '', '#KBO #프로야구 #야구 #야구팬 #빠따닷컴'].join('\n');
  const story = `<section class="s story dark hook"${photo('balls')}><p class="kicker">${md(today)} 오늘 아침</p><h1>${hl(lead.hook_ko ?? lead.brief_ko!)}</h1><div class="masc">${mascot(lead.team)}</div><div class="sticker">여기에 링크 스티커</div></section>`;
  return { slides, story, caption, key: `${today}-morning` };
}

const nm = (s: GameView['sides'][number]) => (s.id ? short(s.id) : s.label);
const scoreParts = (g: GameView) => { const [a, b] = g.score!.split('-').map(Number); return a >= b ? { w: 0, l: 1, ws: a, ls: b } : { w: 1, l: 0, ws: b, ls: a }; };
const view = () => { const d = loadPostseason(process.env.INSTA_DATA_ROOT || undefined); return d ? resolvePostseason(d, today) : null; };

function pregame(): Made | string {
  const v = view();
  const g = v?.next;
  if (!v || !g || g.date !== today) return '오늘 경기 없음';
  if (!g.record.starters.every(Boolean) || !g.sides.every((s) => s.id)) return '오늘 경기 예고 선발 미확정';
  const r = v.rounds.find((x) => x.id === g.round)!;
  const [a, b] = g.sides;
  const last = lastPlayed(v.rounds);
  const facts = g.record.facts;
  const ig = g.record.ig?.pre;
  const hook = ig?.hook ?? `${nm(a)} vs ${nm(b)}, ${g.no}차전`;
  const lastLine = last && last.score ? (() => { const p = scoreParts(last); return `${v.rounds.find((x) => x.id === last.round)!.short} ${last.no}차전 ${nm(last.sides[p.w])} ${p.ws}-${p.ls} ${nm(last.sides[p.l])}`; })() : '';
  const lastRec = last ? [last.record.win && `승 ${last.record.win}`, last.record.loss && `패 ${last.record.loss}`, last.record.mvp && `MVP ${last.record.mvp}`].filter(Boolean).join(' · ') : '';
  const slides = [
    `<section class="s dark hook"${photo('lights')}>${top(`${r.short} ${g.no}차전 · 오늘 ${g.time}`, '1/5')}<h1>${hl(hook)}</h1><p class="stat-line">${esc(ig?.sub ?? facts[0] ?? `${g.venue}, 시리즈 ${nm(a)} ${a.wins}승 · ${nm(b)} ${b.wins}승`)}</p><div class="masc">${mascot(a.id)}<span class="vs">vs</span>${mascot(b.id)}</div>${foot(logo, '<span class="swipe">옆으로 넘겨 보기 ›</span>')}</section>`,
    `<section class="s dark">${top('예고 선발', '2/5')}<h2>${esc(g.time)} ${esc(g.venue)}</h2><div class="vsgrid">${[0, 1].map((i) => `<div class="side">${mascot(g.sides[i].id)}<div class="t">${esc(nm(g.sides[i]))} ${g.sides[i].wins}승</div><div class="lab">선발</div><div class="p">${esc(g.record.starters[i]!)}</div><div class="n">${esc(g.record.starterNotes[i] ?? '')}</div></div>`).join('<div class="v">vs</div>')}</div><p class="series-line center">시리즈 <b>${esc(nm(a))} ${a.wins}승</b> · <b>${esc(nm(b))} ${b.wins}승</b> · ${r.toWin}선승제</p>${foot(`${esc(r.short)} ${g.no}차전`)}</section>`,
    `<section class="s dark">${top('관전 포인트', '3/5')}<ul class="facts">${(facts.length ? facts : [`시리즈 ${nm(a)} ${a.wins}승 · ${nm(b)} ${b.wins}승`]).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>${lastLine ? `<div class="last"><span>지난 경기</span><b>${esc(lastLine)}</b><p>${esc(lastRec)}</p></div>` : ''}${foot('출처: 언론 보도')}</section>`,
    `<section class="s dark cta">${top('승부 예측', '4/5')}<h2>오늘,<br>누가 이길까요?</h2><div class="vote">${[a, b].map((s) => `<div style="background:${T.get(s.id!)?.color ?? '#333'}">${mascot(s.id)}${esc(nm(s))} 승</div>`).join('')}</div><p class="series-line center">댓글로 예측을 남기거나<br>사이트에서 투표해 보세요</p>${foot(logo)}</section>`,
    guide,
  ];
  const caption = [`⚾ ${flat(hook)}`, '', `오늘 ${g.time}, ${g.venue}`, `${nm(a)} ${g.record.starters[0]} vs ${nm(b)} ${g.record.starters[1]}`, '', ...facts.map((f) => `📌 ${f}`), ...(facts.length ? [''] : []), '이길 팀을 댓글로 남겨 주세요 👇', '승부예측 투표는 프로필 링크에서 할 수 있어요 🗳️', '', `#KBO #가을야구 #${g.roundName.replace(/\s/g, '')} #${T.get(a.id!)?.name.replace(/\s/g, '')} #${T.get(b.id!)?.name.replace(/\s/g, '')} #빠따닷컴`].join('\n');
  const story = `<section class="s story dark hook"${photo('lights')}><p class="kicker">${esc(g.roundName)} ${g.no}차전 · 오늘 ${esc(g.time)}</p><h1>${hl(hook)}</h1><p class="stat-line">${esc(g.record.starters[0]!)} vs ${esc(g.record.starters[1]!)}</p><div class="masc">${mascot(a.id)}<span class="vs">vs</span>${mascot(b.id)}</div><div class="sticker">여기에 링크 스티커</div></section>`;
  return { slides, story, caption, key: `${today}-pregame-${g.round}${g.no}` };
}

function postgame(): Made | string {
  const v = view();
  if (!v) return '포스트시즌 데이터 없음';
  let r: RoundView | undefined; let g: GameView | undefined;
  for (const x of v.rounds) for (const y of x.games) if (y.date === today && y.played && y.score) { r = x; g = y; }
  if (!r || !g || !g.sides.every((s) => s.id)) return '오늘 경기 결과 없음';
  const p = scoreParts(g);
  const W = g.sides[p.w], L = g.sides[p.l];
  const ig = g.record.ig?.post;
  const nextRound = r.winner ? v.rounds[v.rounds.indexOf(r) + 1] : undefined;
  const hook = ig?.hook ?? (r.winner ? (nextRound ? `${nm(W)}, ${nextRound.short} 간다` : `${nm(W)}, 우승!`) : `${nm(W)}, ${W.wins}승째`);
  const rec = [['MVP', g.record.mvp], ['승리', g.record.win && `${g.record.win} (${nm(W)})`], ['패전', g.record.loss && `${g.record.loss} (${nm(L)})`], ['세이브', g.record.save && `${g.record.save} (${nm(W)})`], ['홈런', g.record.homers.slice(0, 3).join(', ')]].filter(([, x]) => x) as [string, string][];
  const games = r.games.filter((x) => !x.skipped).slice(0, 5);
  const nx = r.next;
  const slides = [
    `<section class="s dark hook"${photo('stadium')}>${top(`${r.short} ${g.no}차전 결과`, '1/5')}<h1>${hl(hook)}</h1><p class="big-score">${esc(nm(W))} ${p.ws} : ${p.ls} ${esc(nm(L))}</p><p class="stat-line">${esc(ig?.sub ?? `시리즈 ${nm(r.sides[0])} ${r.sides[0].wins}승 · ${nm(r.sides[1])} ${r.sides[1].wins}승`)}</p><div class="masc">${mascot(W.id)}${mascot(L.id, 'lose')}</div>${foot(logo, '<span class="swipe">옆으로 넘겨 보기 ›</span>')}</section>`,
    `<section class="s dark">${top('경기 결과', '2/5')}<div class="score">${'<div>' + mascot(W.id) + `<p>${esc(nm(W))}</p><span class="wb">승리</span></div>`}<div class="num">${p.ws}<i>:</i>${p.ls}</div><div class="lose">${mascot(L.id)}<p>${esc(nm(L))}</p></div></div><dl class="rec compact">${rec.map(([k, x]) => `<div class="${k === 'MVP' ? 'mvp' : ''}"><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>${foot(`${md(g.date)} · ${esc(g.venue)}${g.record.attendance ? ` · ${esc(g.record.attendance)}` : ''}`)}</section>`,
    ig?.points.length
      ? `<section class="s dark">${top('승부처', '3/5')}<h2>오늘 경기를 가른 장면</h2><ol class="points">${ig.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>${foot('출처: 언론 보도')}</section>`
      : `<section class="s dark">${top('경기 기록', '3/5')}<h2>오늘의 주인공</h2><dl class="rec">${rec.slice(0, 3).map(([k, x]) => `<div class="${k === 'MVP' ? 'mvp' : ''}"><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>${foot('출처: 언론 보도')}</section>`,
    `<section class="s dark">${top(`${r.short} 시리즈`, '4/5')}<h2>${esc(nm(r.sides[0]))} ${r.sides[0].wins}승 · ${esc(nm(r.sides[1]))} ${r.sides[1].wins}승</h2><div class="games">${games.map((x) => `<div class="g${x === nx ? ' next' : ''}${!x.played && x !== nx ? ' later' : ''}"><b>${x.no}차전</b><span>${Number(x.date.slice(5, 7))}.${Number(x.date.slice(8, 10))} ${esc(x.venue)}</span><span class="r">${x.played && x.score ? (() => { const q = scoreParts(x); return `${esc(nm(x.sides[q.w]))} ${q.ws}-${q.ls}`; })() : x === nx ? '다음 경기' : x.ifNeeded ? '미확정' : ''}</span></div>`).join('')}</div>${nx ? `<p class="series-line">다음 경기는 ${nx.no}차전, ${Number(nx.date.slice(5, 7))}월 ${Number(nx.date.slice(8, 10))}일 ${esc(nx.time)} ${esc(nx.venue)} </p>` : ''}${foot('일정: KBO 발표')}</section>`,
    guide,
  ];
  const caption = [`⚾ ${flat(hook)}`, '', `${nm(W)} ${p.ws}-${p.ls} ${nm(L)}`, ...(ig?.sub ? [ig.sub] : []), '', ...(ig?.points.length ? ig.points.map((x) => `✔ ${x}`) : rec.map(([k, x]) => `${k} ${x}`)), '', ...(nx ? [`다음 경기는 ${Number(nx.date.slice(5, 7))}월 ${Number(nx.date.slice(8, 10))}일 ${nx.time}, ${nx.venue}에서 열려요.`] : []), '하이라이트와 기록은 프로필 링크에서 볼 수 있어요 🎬', '', `#KBO #가을야구 #${g.roundName.replace(/\s/g, '')} #${T.get(W.id!)?.name.replace(/\s/g, '')} #${T.get(L.id!)?.name.replace(/\s/g, '')} #빠따닷컴`].join('\n');
  const story = `<section class="s story dark hook"${photo('stadium')}><p class="kicker">${esc(g.roundName)} ${g.no}차전 결과</p><h1>${hl(hook)}</h1><p class="big-score">${esc(nm(W))} ${p.ws} : ${p.ls} ${esc(nm(L))}</p><div class="masc">${mascot(W.id)}${mascot(L.id, 'lose')}</div><div class="sticker">여기에 링크 스티커</div></section>`;
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
  const pdir = join(ROOT, 'scripts/insta/photos');
  if (existsSync(pdir)) { mkdirSync(join(out, 'p'), { recursive: true }); for (const f of readdirSync(pdir)) if (f.endsWith('.jpg') && !f.startsWith('.')) copyFileSync(join(pdir, f), join(out, 'p', f)); }
  const body = [...made.slides.map((s, i) => s.replace('<section class="s', `<section id="s${i + 1}" class="s`)), made.story.replace('<section class="s', '<section id="sstory" class="s')].join('\n');
  writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}<script>document.getElementById('s'+(new URLSearchParams(location.search).get('s')||'1')).classList.add('on')</script></body></html>`);
  console.log(JSON.stringify({ key: made.key, kind, caption: made.caption }));
}

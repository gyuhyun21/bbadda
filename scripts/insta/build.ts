// 인스타 카루셀 세트(5장 + 스토리 1장) HTML 만들기. 사이트 데이터만 쓴다(추론 없음). 그림은 .github/workflows/ig-auto.yml 이 크롬으로 찍는다.
// 사용: npx tsx scripts/insta/build.ts <auto|morning|pregame|postgame> <출력 폴더>   (INSTA_DATE 로 날짜 지정 가능)
//   → 출력 폴더에 index.html(?s=1..5, ?s=story)·자산 복사, 표준 출력에 JSON { key, kind, caption } 또는 { skip: 이유 }
// 세트: 아침(구단별 한 줄, 최근 이틀 안의 brief_ko 가 하나라도 있으면) / 경기 전(오늘 경기 예고 선발이 있을 때) / 경기 후(오늘 경기 결과가 있을 때)
//   경기 없는 날의 경기 전·경기 후 자리는 그 실행에 새로 요약된 소식으로 '오후판'·'저녁판'을 만든다(하루 세 번 게시, 2026-10-21)
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

/** 게시물의 큰 자리에는 마스코트 대신 팀 색 원형 배지(팀 이름) — 큰 마스코트는 어색하다는 주인 의견(2026-10-19) */
const badge = (id?: string, cls = '') => (id ? `<span class="tbadge ${cls}" style="--tc:${T.get(id)?.color ?? '#333'}">${esc(short(id))}</span>` : '');
const mascot = (id?: string, cls = '') => (id ? `<img class="${cls}" src="m/${id}.svg" alt="">` : '');
// 첫 장 배경 사진(무료 라이선스, scripts/insta/photos/SOURCES.md). 로고·간판이 읽히지 않게 흐리게 깐다(balls 는 깨끗해서 덜 흐리게). 없으면 그라디언트만
const BLUR: Record<string, number> = { balls: 2 };
const photo = (name: string) => (existsSync(join(ROOT, 'scripts/insta/photos', `${name}.jpg`)) ? ` style="--bg:url(p/${name}.jpg);--blur:${BLUR[name] ?? 12}px" data-photo` : '');

// 릴스 스타일(2026-10-21, 주인 결정): 첫 장 노란 바탕 + 큰 숫자·점수 + 마지막 줄 밑줄, 안쪽 장은 흐린 사진 위 둥근 카드. 고정 안내 장 없음(4장)
/** 2줄 이상이면 마지막 줄에 굵은 밑줄 */
const ul = (s: string) => { const l = esc(s).split('\n'); return l.length > 1 ? `${l.slice(0, -1).join('<br>')}<br><u>${l[l.length - 1]}</u>` : `<u>${l[0]}</u>`; };
const mark = '<img class="mark" src="logo.webp" alt="">';
const yHook = (o: { kick: string; big: string; head: string; sub?: string; pg: string; story?: boolean }) =>
  `<section class="s y${o.story ? ' story' : ''}"><div class="yt"><span class="kick">${esc(o.kick)}</span>${o.story ? '' : `<span class="pg">${o.pg}</span>`}</div><div class="yb${o.big.replace(/<[^>]+>/g, '').length > 5 ? ' sm' : ''}">${o.big}</div><h1>${ul(o.head)}</h1>${o.sub ? `<p class="ys">${esc(o.sub)}</p>` : ''}${o.story ? '<div class="sticker">여기에 링크 스티커</div>' : mark}</section>`;
const panel = (o: { step: string; head: string; pg: string; body: string; bg?: string; note?: string }) =>
  `<section class="s pn"${photo(o.bg ?? 'stadium')}><div class="yt"><span class="step">${esc(o.step)}</span><span class="pg">${o.pg}</span></div><h2>${ul(o.head)}</h2><div class="pcard">${o.body}</div><div class="pf"><span>${o.note ?? ''}</span>${mark}</div></section>`;
/** 큰 글자: 문장 속 첫 숫자 덩어리(예: 34억·78%·3년), 없으면 팀 이름 */
const bigOf = (line: string, team?: string) => esc(/\d[\d,.]*\s?(%|년|억|만|승|패|연승|연패|홈런|안타|타점|위|명|경기|차전)?/.exec(line)?.[0] ?? short(team));

type Made = { slides: string[]; story: string; caption: string; key: string };

/** 경기 없는 날 낮·밤 자리: 그 실행에 새로 요약한 소식(가장 최근 수집 묶음) 위주 */
type Slot = { id: 'pm' | 'night'; tag: string; when: string; icon: string };
const SLOT: Record<Slot['id'], Slot> = { pm: { id: 'pm', tag: '오후판', when: '오늘 오후', icon: '🌤️' }, night: { id: 'night', tag: '저녁판', when: '오늘 밤', icon: '🌙' } };

function morning(slot?: Slot): Made | string {
  const sigs: (Sig & { hook_ko?: string; summary_ko?: string })[] = [];
  for (const w of readdirSync(join(ROOT, 'src/content/signals'))) {
    const dir = join(ROOT, 'src/content/signals', w);
    if (!/^\d{4}-W\d{2}$/.test(w)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('.')) sigs.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  // 매일 아침 반드시 만든다. 구단별 한 줄 고르는 순서: 오늘 brief_ko → 최근 7일 brief_ko → 최근 7일 뉴스 요약 앞부분(어절 단위로 자름)
  const dayOf = (x: Sig) => new Date(Date.parse(x.collected_at) + 9 * 3600_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86400_000).toISOString().slice(0, 10);
  let recent = sigs.filter((s) => s.team && T.has(s.team) && dayOf(s) >= weekAgo && dayOf(s) <= today);
  if (slot) {
    // 오늘 수집분 중 가장 최근 묶음(3시간 안). 요약이 있는 것만
    const todays = recent.filter((s) => dayOf(s) === today && ((s as { summary_ko?: string }).summary_ko ?? '').trim());
    const last = Math.max(0, ...todays.map((s) => Date.parse(s.collected_at)));
    const batch = todays.filter((s) => Date.parse(s.collected_at) >= last - 3 * 3600_000);
    recent = batch.length ? batch : todays;
  }
  const score = (x: Sig) => (dayOf(x) === today ? 1000 : 0) + (x.brief_ko ? 500 : 0) + x.scores.hot;
  // 비상용 한 줄: 요약 첫 문장에서 매체 이름 주어·기사체 꼬리를 떼고 어절 단위로 24자 안팎
  const clip = (x: Sig & { summary_ko?: string; source_name?: string }) => {
    let t = (x.summary_ko ?? '').split(/(?<=[.다요])\s/)[0];
    const src = (x.source_name ?? '').replace(/[()]/g, '');
    if (src) t = t.replace(new RegExp(`^${src.replace(/[.*+?^${}|[\]\\]/g, '\\$&')}(가|는|이|에서는|에서)\\s*`), '');
    t = t.replace(/^(한 매체가|매체는|보도에 따르면)\s*/, '').replace(/\s*(고|다고|라고)\s*\S+(가|이)\s*전했다\.?$/, '').replace(/했다고 공식 발표했다\.?$/, '').replace(/[.。]$/, '');
    if (t.length <= 26) return t;
    const cut = t.slice(0, 26); const sp = cut.lastIndexOf(' ');
    return (sp > 12 ? cut.slice(0, sp) : cut) + '…';
  };
  const best = new Map<string, (typeof recent)[number]>();
  for (const s of recent) if ((s.brief_ko || ((s.source_type === 'news' || (slot && (s as { official?: boolean }).official)) && s.summary_ko && !/^보도에 따르면|루머|설$/.test(s.summary_ko))) && (!best.has(s.team!) || score(s) > score(best.get(s.team!)!))) best.set(s.team!, s);
  for (const [k, s] of best) if (!s.brief_ko) best.set(k, { ...s, brief_ko: clip(s), clipped: true } as typeof s);
  if (best.size === 0) return slot ? '오늘 새로 요약된 구단 소식 없음' : '최근 7일 안에 구단 소식이 하나도 없음';
  const ranked = [...best.values()].sort((a, b) => (b.hook_ko ? 1 : 0) - (a.hook_ko ? 1 : 0) || score(b) - score(a));
  const lead = ranked[0];
  // 첫 장 제목은 잘린 문장을 쓰지 않는다: 루틴 후크 → 루틴 한 줄 → 오늘 경기 → '오늘 아침 KBO 소식'
  const gToday = view()?.next;
  const headline = (slot ? undefined : lead.hook_ko) ?? (!(lead as { clipped?: boolean }).clipped ? lead.brief_ko! : gToday && gToday.date === today ? `오늘 ${gToday.roundName}\n${gToday.no}차전` : slot ? `${slot.when}\nKBO 소식` : '오늘 아침\nKBO 소식');
  const tops = ranked.slice(0, 3);
  const rows = TEAMS.filter((t) => best.has(t.id)).map((t) => ({ id: t.id, line: best.get(t.id)!.brief_ko! }));
  const n = rows.length;
  const teamsLabel = n === TEAMS.length ? '10개 구단' : '구단';
  // 한 줄이 적은 날은 4장째를 다른 내용으로: 오늘 가을야구 경기가 있으면 예고, 없으면 선수응원가 연습
  const g = view()?.next;
  const gWhen = g ? (g.date === today ? '오늘' : `${md(g.date)}(${wd(g.date)})`) : '';
  const extra = g && g.date >= today && g.sides.every((x) => x.id)
    ? panel({ step: g.date === today ? '오늘의 가을야구' : '다음 가을야구', head: `${g.roundName} ${g.no}차전\n${gWhen} ${g.time} ${g.venue}`, pg: '4/5', note: '예고 선발·관전 포인트는 경기 날 올려 드려요', body: `<div class="masc static">${badge(g.sides[0].id)}<span class="vs">vs</span>${badge(g.sides[1].id)}</div>` })
    : panel({ step: '선수응원가 연습', head: '직관 가기 전에\n응원가 한 번씩', pg: '4/5', note: 'bbadda.com 메뉴 선수응원가 연습', body: `<p class="pq">MY팀 선수 응원가를 공식 영상으로, 한 곡 반복 · 0.75배속까지</p>` });
  // 장 구성(docs/insta-style.md 3절): 후킹 → 큰 소식 → 소식 2·3 → 참여 질문. 구단별 한 줄은 본문(캡션)에 둔다
  const sub = (x: (typeof tops)[number]) => esc(((x as { summary_ko?: string }).summary_ko ?? '').slice(0, 110));
  const nums = ['①', '②', '③'];
  const bg = slot ? 'stadium' : 'balls';
  const slides = [
    yHook({ kick: `${md(today)} ${slot?.tag ?? '아침판'}`, big: bigOf(lead.brief_ko!, lead.team), head: headline, sub: `${n}개 구단 소식 중 큰 것 ${tops.length}개만 골랐어요`, pg: '1/4' }),
    panel({ step: '오늘의 큰 소식', head: tops[0].brief_ko!.replace(/, /, ',\n'), pg: '2/4', bg, note: '출처: 언론 보도 · 우리 요약', body: `<p class="plab"><b>${esc(short(tops[0].team))}</b>${esc(md(today))}</p><p class="pq">${sub(tops[0])}</p>` }),
    tops.length > 1
      ? panel({ step: '이것도 놓치지 마세요', head: `같이 보면 좋은\n소식 ${tops.length - 1}개`, pg: '3/4', bg, note: '출처: 언론 보도 · 우리 요약', body: `<div class="news">${tops.slice(1).map((x) => `<div class="n-item">${mascot(x.team)}<div><b>${esc(x.brief_ko!)}</b><p>${sub(x)}</p></div></div>`).join('')}</div>` })
      : extra.replace("'4/5'", "'3/4'"),
    panel({ step: '여러분 생각은?', head: '오늘 가장 큰 소식,\n몇 번인가요?', pg: '4/4', bg, note: '댓글로 번호를 남겨 주세요', body: `<ol class="pick">${tops.map((x, i) => `<li><i>${nums[i]}</i>${esc(short(x.team))} · ${esc(x.brief_ko!)}</li>`).join('')}</ol>` }),
  ];
  const caption = [`${slot?.icon ?? '☀️'} ${flat(headline)}`, '', ...tops.map((x, i) => `${nums[i]} ${short(x.team)} ${x.brief_ko}`), '', `${slot?.when ?? '오늘 아침'} ${teamsLabel} 한 줄`, ...rows.map((r) => `${short(r.id)}  ${r.line}`), '', '오늘 가장 큰 소식은 몇 번? 댓글로 남겨 주세요 👇', '더 자세한 소식은 프로필 링크에서 볼 수 있어요.', '', '#KBO #프로야구 #야구 #야구팬 #빠따닷컴'].join('\n');
  const story = yHook({ kick: `${md(today)} ${slot?.when ?? '오늘 아침'}`, big: bigOf(lead.brief_ko!, lead.team), head: headline, pg: '', story: true });
  return { slides, story, caption, key: slot ? `${today}-${slot.id}` : `${today}-morning` };
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
    yHook({ kick: `${r.short} ${g.no}차전 · 오늘 ${g.time}`, big: `${esc(nm(a))}<i>vs</i>${esc(nm(b))}`, head: hook, sub: `선발 ${g.record.starters[0]} vs ${g.record.starters[1]}`, pg: '1/4' }),
    panel({ step: '예고 선발', head: `${g.time} ${g.venue}\n선발 맞대결`, pg: '2/4', bg: 'lights', note: `시리즈 ${nm(a)} ${a.wins}승 · ${nm(b)} ${b.wins}승 · ${r.toWin}선승제`, body: `<div class="vsgrid">${[0, 1].map((i) => `<div class="side">${badge(g.sides[i].id)}<div class="t">${esc(nm(g.sides[i]))} ${g.sides[i].wins}승</div><div class="lab">선발</div><div class="p">${esc(g.record.starters[i]!)}</div><div class="n">${esc(g.record.starterNotes[i] ?? '')}</div></div>`).join('<div class="v">vs</div>')}</div>` }),
    panel({ step: '관전 포인트', head: '오늘은\n이것만 보세요', pg: '3/4', bg: 'lights', note: '출처: 언론 보도', body: `<ul class="facts">${(facts.length ? facts : [`시리즈 ${nm(a)} ${a.wins}승 · ${nm(b)} ${b.wins}승`]).slice(0, 3).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>${lastLine ? `<div class="last"><span>지난 경기</span><b>${esc(lastLine)}</b><p>${esc(lastRec)}</p></div>` : ''}` }),
    panel({ step: '승부 예측', head: '오늘,\n누가 이길까요?', pg: '4/4', bg: 'lights', note: '댓글로 남기거나 사이트에서 투표', body: `<div class="vote">${[a, b].map((x) => `<div style="background:${T.get(x.id!)?.color ?? '#333'}">${esc(nm(x))} 승</div>`).join('')}</div>` }),
  ];
  const caption = [`⚾ ${flat(hook)}`, '', `오늘 ${g.time}, ${g.venue}`, `${nm(a)} ${g.record.starters[0]} vs ${nm(b)} ${g.record.starters[1]}`, '', ...facts.map((f) => `📌 ${f}`), ...(facts.length ? [''] : []), '이길 팀을 댓글로 남겨 주세요 👇', '승부예측 투표는 프로필 링크에서 할 수 있어요 🗳️', '', `#KBO #가을야구 #${g.roundName.replace(/\s/g, '')} #${T.get(a.id!)?.name.replace(/\s/g, '')} #${T.get(b.id!)?.name.replace(/\s/g, '')} #빠따닷컴`].join('\n');
  const story = yHook({ kick: `${g.roundName} ${g.no}차전 · 오늘 ${g.time}`, big: `${esc(nm(a))}<i>vs</i>${esc(nm(b))}`, head: hook, sub: `${g.record.starters[0]} vs ${g.record.starters[1]}`, pg: '', story: true });
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
  const series = `시리즈 ${nm(r.sides[0])} ${r.sides[0].wins}승 · ${nm(r.sides[1])} ${r.sides[1].wins}승`;
  const slides = [
    yHook({ kick: `${r.short} ${g.no}차전 결과`, big: `${p.ws}<i>:</i>${p.ls}`, head: hook, sub: ig?.sub ?? `${nm(W)} ${p.ws}-${p.ls} ${nm(L)} · ${series}`, pg: '1/4' }),
    panel({ step: '경기 결과', head: `${nm(W)} 승리\n오늘의 기록`, pg: '2/4', note: `${md(g.date)} · ${g.venue}${g.record.attendance ? ` · ${g.record.attendance}` : ''}`, body: `<div class="score">${'<div>' + badge(W.id) + `<span class="wb">승리</span></div>`}<div class="num">${p.ws}<i>:</i>${p.ls}</div><div class="lose">${badge(L.id)}</div></div><dl class="rec compact">${rec.slice(0, 3).map(([k, x]) => `<div class="${k === 'MVP' ? 'mvp' : ''}"><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>` }),
    ig?.points.length
      ? panel({ step: '승부처', head: '오늘 경기를\n가른 장면', pg: '3/4', note: '출처: 언론 보도', body: `<ol class="points">${ig.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` })
      : panel({ step: '경기 기록', head: '오늘의\n주인공', pg: '3/4', note: '출처: 언론 보도', body: `<dl class="rec">${rec.slice(0, 3).map(([k, x]) => `<div class="${k === 'MVP' ? 'mvp' : ''}"><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>` }),
    panel({ step: '여러분 생각은?', head: '오늘 경기\nMVP는 누구?', pg: '4/4', note: nx ? `다음 경기 ${nx.no}차전 · ${Number(nx.date.slice(5, 7))}월 ${Number(nx.date.slice(8, 10))}일 ${nx.time} ${nx.venue}` : series, body: `<p class="pq">댓글로 선수 이름을 남겨 주세요</p><div class="games">${games.map((x) => `<div class="g${x === nx ? ' next' : ''}${!x.played && x !== nx ? ' later' : ''}"><b>${x.no}차전</b><span>${Number(x.date.slice(5, 7))}.${Number(x.date.slice(8, 10))} ${esc(x.venue)}</span><span class="r">${x.played && x.score ? (() => { const q = scoreParts(x); return `${esc(nm(x.sides[q.w]))} ${q.ws}-${q.ls}`; })() : x === nx ? '다음 경기' : x.ifNeeded ? '미확정' : ''}</span></div>`).join('')}</div>` }),
  ];
  const caption = [`⚾ ${flat(hook)}`, '', `${nm(W)} ${p.ws}-${p.ls} ${nm(L)}`, ...(ig?.sub ? [ig.sub] : []), '', ...(ig?.points.length ? ig.points.map((x) => `✔ ${x}`) : rec.map(([k, x]) => `${k} ${x}`)), '', ...(nx ? [`다음 경기는 ${Number(nx.date.slice(5, 7))}월 ${Number(nx.date.slice(8, 10))}일 ${nx.time}, ${nx.venue}에서 열려요.`] : []), '오늘 MVP는 누구였나요? 댓글로 남겨 주세요 👇', '하이라이트와 기록은 프로필 링크에서 볼 수 있어요 🎬', '', `#KBO #가을야구 #${g.roundName.replace(/\s/g, '')} #${T.get(W.id!)?.name.replace(/\s/g, '')} #${T.get(L.id!)?.name.replace(/\s/g, '')} #빠따닷컴`].join('\n');
  const story = yHook({ kick: `${g.roundName} ${g.no}차전 결과`, big: `${p.ws}<i>:</i>${p.ls}`, head: hook, sub: `${nm(W)} ${p.ws}-${p.ls} ${nm(L)}`, pg: '', story: true });
  return { slides, story, caption, key: `${today}-postgame-${g.round}${g.no}` };
}

const CSS = readFileSync(join(ROOT, 'scripts/insta/cards.css'), 'utf8');

if (process.argv[1]?.endsWith('build.ts')) {
  const arg = process.argv[2] ?? 'auto';
  const out = process.argv[3] ?? 'insta-out';
  const kind: Kind = arg === 'auto' ? kindAt(kst.getUTCDay(), kst.getUTCHours()) : (arg as Kind);
  let made = kind === 'morning' ? morning() : kind === 'pregame' ? pregame() : postgame();
  // 경기 없는 날(또는 결과·선발 미확정)에는 그 시간대 소식 세트로 대신한다
  if (typeof made === 'string' && kind !== 'morning' && /경기 없음|결과 없음|데이터 없음/.test(made)) {
    const alt = morning(SLOT[kind === 'pregame' ? 'pm' : 'night']);
    made = typeof alt === 'string' ? `${made} · ${alt}` : alt;
  }
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

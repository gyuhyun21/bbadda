// 매일 릴스 조립(2026-10-24 주인 결정: 하루 1개 자동 릴스). 루틴(docs/reel-routine.md)이 만든 재료 폴더를 영상 하나로 합친다.
// 사용: npx tsx scripts/insta/reel-make.ts <재료 폴더> <출력 mp4>   (크롬: CHROME 환경변수, 없으면 google-chrome / ffmpeg 필요)
// 재료 폴더의 reel.json:
//   { music?: 'bgm-breaking', segments: [{ src: '1.mp4'|'1.png', say: 'a1.mp3', kick: '짧은 머리표', head: '큰 제목(<b>강조</b>, <br> 줄바꿈)', note?: '아래 작은 글(출처 등)', sub?: '하단 자막 한 줄(2026-11-08~, 20자 안팎)' }],
//     end?: { kick, head, a?: 'kia', b?: 'samsung', cta: '롯데팬 친구한테 보내 줘', say?: 'a9.mp3' } }
// 장면 길이 = 그 장면 목소리 길이(쉼 0.18초·1.18배로 다듬은 뒤) + 0.25초(목소리가 없으면 dur, 기본 3초). 그림(png)은 천천히 확대, 영상은 길이에 맞춰 자르거나 늘린다.
// fit: true 인 그림(카드 이미지 등)은 자르지 않고 흐린 배경 위에 통째로 놓는다. 어떤 경우에도 영상은 만든다(그날 릴스를 빠뜨리지 않는다, 2026-10-24 주인).
// 경기 영상(2026-10-26 주인 결정, 티빙·KBO 허용 범위: 비영리·40초 미만): 영상 장면은 from·to(원본 초)로 구간을 고르고, live: true 면 현장음을 섞는다.
//   가로 영상은 기본으로 흐린 배경 위에 통째로 놓는다(fit: false 면 세로로 꽉 채워 자름). 경기 영상 합계는 FOOTAGE_MAX 초를 넘지 않게 자른다(넘으면 뒤 장면부터 줄임).
// 공식 영상 썸네일 장면(2026-10-26): src 에 i.ytimg.com 주소를 그대로 쓴다(파일을 저장소에 두지 않고 조립할 때만 받음, 고해상도가 없으면 hqdefault). 그림 파일에 credit(예 'TVING')을 주면 경기 영상의 한 장면으로 보고 — 흐린 배경 위에 통째로(로고·워터마크를 자르지 않음), 화면에 '영상: <credit>', 길이를 경기 영상 합계에 넣는다.
// 장면 효과(2026-11-10 이재용(CoS) 배분, save pool 릴스): 장면에 아래 칸을 더하면 장면 안의 그 시각(장면 시작부터 초, 배속 전)에 효과가 들어간다. 없으면 예전과 똑같이 조립한다.
//   fx: [{ at, dur?, text, style?: 'mind'(심리 자막)|'pop'(강조)|'sfx'(효과음 글자), pos?: 'top'|'mid'|'low'|[x, y](글 가운데 좌표), size?: 글자 px }] — 글마다 그림 한 장, 스타일별 등장 움직임(FX_MOVE). 덤 style: alert(경고)·think(속마음 말풍선)·stamp(판정 도장)
//   motion: true (또는 kind: 'motion') — scripts/insta/motion 에서 만든 1080x1920 모션그래픽 mp4. 자르거나 흐린 배경 없이 그대로 깔고, 경기 영상 합계에서 빼며 표기는 '영상: 빠따닷컴 모션'.
//   맨 위 칸(선택): subStyle: 'yt'(하단 자막을 검은고딕·흰 글자+검정 테두리로, 우영미 2026-11-11 확정판 fonts.css) · outro: { hold: 끝 장면에 더할 초, fade: 마지막 페이드아웃 초 }
//   zoom·shake·freeze·lines(집중선)·flash: { at, dur? } — 서서히 1.2배 확대 / 흔들림 / 그 프레임에서 멈춤 / 집중선 / 흰 번쩍임. 흔들림이 있으면 배경을 1.075배 키워 가장자리를 자른다.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

type Seg = { src: string; say?: string; text?: string; kick?: string; head?: string; note?: string; sub?: string; dur?: number; fit?: boolean; motion?: boolean; kind?: string; from?: number; to?: number; live?: boolean; credit?: string } & Partial<Record<'zoom' | 'shake' | 'freeze' | 'lines' | 'flash', Cue>> & { fx?: Fx[] };
type Cue = { at: number; dur?: number };
type Fx = Cue & { text: string; style?: string; pos?: 'top' | 'mid' | 'low' | [number, number]; size?: number };
const FOOTAGE_MAX = 39; // 티빙·KBO 허용 '40초 미만'보다 1초 여유
const REEL_MAX = 120; // 2026-11-12 이사님: 릴스 길이는 2분 이내, 그 안에서는 제한 없음(넘으면 경고만 — 그날 릴스는 빠뜨리지 않는다)
const SPEED = 1.0; // 2026-11-10 이사님 결정: 영상 원속도(이전 1.3배 폐지). 다 만든 영상 전체(목소리·전환·음악)에 거는 배속, 음 높이는 그대로
type End = { kick?: string; head: string; a?: string; b?: string; cta: string; say?: string; look?: 'profile' };
const ROOT = process.cwd();
const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg || !outArg) { console.error('사용: reel-make.ts <재료 폴더> <출력 mp4>'); process.exit(1); }
const DIR = resolve(dirArg), OUT = resolve(outArg), TMP = join(DIR, '.make');
mkdirSync(TMP, { recursive: true });
const spec = JSON.parse(readFileSync(join(DIR, 'reel.json'), 'utf8')) as { music?: string; segments: Seg[]; end?: End; subStyle?: 'yt'; outro?: { hold?: number; fade?: number } };
// 목소리 대본에 아라비아 숫자가 있으면 잘못 읽혔을 수 있다('24 대 5'→'스물네 대 오', 2026-10-24) — 그 장면만 목소리를 끄고 화면 글·음악으로 내보낸다
for (const s of spec.segments) if (/\d/.test(s.text ?? '')) { console.error(`경고: 대본에 숫자가 남아 이 장면 목소리를 끔 — ${s.text}`); s.say = undefined; }
const hasVoice = (s: { say?: string }) => !!s.say && existsSync(join(DIR, s.say));
const ff = (...a: string[]) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
const dur = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const CHROME = process.env.CHROME || 'google-chrome';
const shot = (html: string, png: string) => {
  writeFileSync(join(TMP, 'ov.html'), html);
  execFileSync(CHROME, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--allow-file-access-from-files', '--default-background-color=00000000', '--window-size=1080,1920', '--virtual-time-budget=3000', `--screenshot=${png}`, `file://${join(TMP, 'ov.html')}`], { stdio: 'ignore', timeout: 90_000 });
};
for (const [f, to] of [['public/brand/bbadda-logo.webp', 'logo.webp'], ['public/fonts/pretendard/PretendardVariable.subset.woff2', 'font.woff2'], ['scripts/insta/fonts/YeonSung.subset.woff2', 'fx.woff2'], ['scripts/insta/fonts/BlackHanSans.subset.woff2', 'sub.woff2']]) copyFileSync(join(ROOT, f), join(TMP, to));

const CSS = `@font-face{font-family:P;src:url(font.woff2) format('woff2');font-weight:100 900}
@font-face{font-family:FX;src:url(fx.woff2) format('woff2')}@font-face{font-family:SUB;src:url(sub.woff2) format('woff2')}
*{box-sizing:border-box;margin:0} html,body{background:transparent} body{font-family:P;word-break:keep-all;width:1080px;height:1920px;position:relative;color:#fff}
body>*{position:absolute}
.logo{right:60px;top:80px;height:64px;background:#fff;border-radius:14px;padding:8px 14px}
.kick{left:70px;top:200px;font-size:42px;font-weight:800;padding:12px 24px;border-radius:14px;background:#ffe03a;color:#111}
h1{left:70px;right:60px;top:290px;font-size:112px;font-weight:900;line-height:1.12;letter-spacing:-.02em;text-shadow:0 0 18px rgba(0,0,0,.6),6px 6px 0 #111;-webkit-text-stroke:3px #111;paint-order:stroke fill}
h1 b{color:#ffe03a;font-weight:900}
.note{left:70px;bottom:70px;font-size:26px;opacity:.85;text-shadow:0 0 8px #000}
.sub{left:60px;right:60px;bottom:330px;text-align:center;font-size:56px;font-weight:800;line-height:1.3;padding:16px 28px;border-radius:18px;background:rgba(0,0,0,.6);text-shadow:0 0 6px #000}
.credit{right:60px;bottom:150px;font-size:24px;opacity:.8;text-shadow:0 0 8px #000}
body.end{background:#ffe03a;color:#111}
.end .kick{top:300px;background:#111;color:#ffe03a;font-size:48px}
.end h1{top:400px;font-size:150px;color:#111;text-shadow:none;-webkit-text-stroke:0}
.vs{left:80px;right:80px;top:780px;display:flex;gap:30px}
.vs div{flex:1;height:420px;border:8px solid #111;border-radius:30px;box-shadow:14px 14px 0 #111;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:90px;font-weight:900;color:#fff}
.vs img{height:250px}
.cta{left:80px;right:80px;top:1320px;background:#111;color:#fff;border-radius:28px;padding:40px 46px;font-size:62px;font-weight:900;line-height:1.3}
.cta small{display:block;font-size:40px;font-weight:700;color:#ffe03a;margin-top:10px}
.fx{font-family:FX,P;position:absolute;left:var(--cx,540px);top:var(--cy,1080px);transform:translate(-50%,-50%) rotate(var(--rot,0deg));
  max-width:900px;text-align:center;line-height:1.15;letter-spacing:-.02em;white-space:nowrap}
.fx.top{--cy:720px} .fx.mid{--cy:1080px} .fx.low{--cy:1330px}

.fx.mind{font-size:70px;color:#fff;background:rgba(17,17,17,.72);padding:14px 34px;border-radius:999px;
  box-shadow:0 0 0 3px rgba(255,255,255,.18)}

.fx.pop{--rot:-4deg;font-size:150px;color:#ffe03a;-webkit-text-stroke:8px #111;paint-order:stroke fill;
  text-shadow:8px 8px 0 #111}

.fx.alert{--rot:-2deg;font-size:96px;color:#fff;background:#d70015;padding:18px 44px 22px;border-radius:20px;
  border:6px solid #111;box-shadow:10px 10px 0 #111}
.fx.alert::before{content:'!';display:inline-block;width:1.05em;height:1.05em;line-height:1.05em;margin-right:.3em;border-radius:50%;
  background:#ffe03a;color:#111;font-size:.8em;vertical-align:.08em}

.fx.think{font-size:60px;color:#111;background:#fff;padding:26px 40px;border-radius:44px;border:5px solid #111;
  box-shadow:8px 8px 0 rgba(0,0,0,.55);white-space:normal;max-width:760px;word-break:keep-all}
.fx.think::after{content:'';position:absolute;left:90px;bottom:-34px;width:40px;height:40px;background:#fff;border-radius:50%;border:5px solid #111}
.fx.think::before{content:'';position:absolute;left:58px;bottom:-66px;width:22px;height:22px;background:#fff;border-radius:50%;border:5px solid #111}

.fx.stamp{--rot:-12deg;width:340px;height:340px;display:flex;align-items:center;justify-content:center;border-radius:50%;
  font-size:104px;color:#ffe03a;background:rgba(17,17,17,.55);border:12px solid #ffe03a;
  box-shadow:0 0 0 8px #111,inset 0 0 0 8px #111;-webkit-text-stroke:5px #111;paint-order:stroke fill}

.fx.sfx{--rot:8deg;font-size:180px;color:#fff;-webkit-text-stroke:10px #111;paint-order:stroke fill;
  filter:drop-shadow(10px 10px 0 #ffe03a);transform:translate(-50%,-50%) rotate(var(--rot)) skewX(-10deg)}
.yt .sub{left:60px;right:60px;bottom:330px;text-align:center;font-family:SUB,P;font-weight:400;font-size:62px;line-height:1.3;letter-spacing:0;
  color:#fff;-webkit-text-stroke:10px #111;paint-order:stroke fill;text-shadow:0 4px 0 #111;background:none;padding:0;border-radius:0}
.prof .pbrand{left:0;right:0;top:400px;text-align:center;font-size:120px;font-weight:900;line-height:1.1;color:#ffe03a;letter-spacing:-.02em;text-shadow:0 4px 18px rgba(0,0,0,.5)}
.pbrand small{display:block;font-size:54px;font-weight:700}
.prof h1{left:60px;right:60px;top:720px;text-align:center;font-size:76px;line-height:1.25;-webkit-text-stroke:0;text-shadow:0 3px 14px rgba(0,0,0,.6)}
.pcard{left:150px;right:150px;top:1040px;background:#16181d;border-radius:36px;padding:40px 44px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.pcard img{position:absolute;left:44px;top:40px;width:150px;height:150px;border-radius:50%;background:#fff;object-fit:contain;padding:22px;border:6px solid #ffe03a}
.pname{margin-left:180px;margin-top:24px;font-size:44px;font-weight:800}.pid{margin-left:180px;margin-top:4px;font-size:32px;opacity:.7}
.pbio{margin-top:64px;font-size:38px;font-weight:600;line-height:1.35}
.pbtn{display:flex;gap:16px;margin-top:30px}.pbtn span{flex:1;text-align:center;padding:20px 0;border-radius:18px;background:#2a2d34;font-size:34px;font-weight:700}.pbtn .f{background:#4a5cff}
.hand{position:absolute;left:230px;bottom:-56px;font-size:100px}
.plogo{left:50%;transform:translateX(-50%);bottom:110px;height:70px;background:#fff;border-radius:14px;padding:8px 14px}
.lines{inset:0;background:repeating-conic-gradient(from 0deg at 50% 45%,transparent 0deg 2.4deg,rgba(255,255,255,.92) 2.4deg 3deg);-webkit-mask:radial-gradient(ellipse 42% 30% at 50% 45%,transparent 55%,#000 100%)}`;
// 효과 자막 .fx.* 값·움직임은 우영미(PD) 시안 2026-11-10(SPEC.md·SPEC-3.md), 글꼴은 2026-11-11 확정판(효과 FX=연성, yt 하단 자막 SUB=검은고딕, 굵기 400). s = 처음 몇 프레임의 크기(글 가운데 기준, 그 뒤 1.0),
// fade = 0.15초 페이드 인·아웃, drop = 위에서 내려오는 px, wob = [좌우 px, 횟수](0.25초), dur = 기본 길이(stamp 는 장면 끝까지), pos = 기본 자리
const FX_MAX: Record<string, number> = { mind: 8, pop: 8, alert: 8, sfx: 3, think: 16, stamp: 3 };
const FX_POS = { top: [540, 720], mid: [540, 1080], low: [540, 1330] } as const;
const FX_MOVE: Record<string, { s: number[]; fade?: boolean; drop?: number; wob?: [number, number]; dur: number; pos: keyof typeof FX_POS }> = {
  mind: { s: [], fade: true, drop: 20, dur: 1.2, pos: 'top' },
  pop: { s: [0.6, 0.83, 1.06, 1.12, 1.06], dur: 1, pos: 'mid' },
  sfx: { s: [1.5, 1.2, 0.92, 0.96], wob: [8, 2], dur: 0.65, pos: 'mid' },
  alert: { s: [0.6, 0.83, 1.06, 1.12, 1.06], wob: [12, 3], dur: 1.2, pos: 'mid' },
  think: { s: [0.85, 0.9, 0.95], fade: true, dur: 2, pos: 'top' },
  stamp: { s: [1.6, 1.6, 1.25, 1.25, 0.95, 0.98], dur: 99, pos: 'mid' },
};
const page = (body: string, cls = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body class="${cls}">${body}</body></html>`;
const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** 제목은 <b>·<br> 만 살린다 */
const head = (s: string) => esc(s).replace(/&lt;(\/?b|br)&gt;/g, '<$1>');
const TEAM: Record<string, { name: string; color: string }> = {};
for (const t of (await import('../../src/lib/config.ts')).loadTeams().teams) TEAM[t.id] = { name: t.short, color: (t as { color?: string }).color ?? '#333' };

const hasAudio = (f: string) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f]).toString().trim() !== '';
const isStill = (src: string) => /\.(png|jpe?g|webp)$/i.test(src);
// i.ytimg.com 썸네일은 조립할 때만 받는다(저장소에 남의 이미지 파일을 두지 않음)
const YT = /^https:\/\/i\.ytimg\.com\/vi\/([\w-]{6,20})\/\w+\.jpg$/;
spec.segments.forEach((s, i) => {
  const m = YT.exec(s.src);
  if (!m) return;
  const f = join(TMP, `yt${i}.jpg`);
  for (const q of ['maxresdefault', 'hqdefault']) {
    try { execFileSync('curl', ['-sSf', '-o', f, `https://i.ytimg.com/vi/${m[1]}/${q}.jpg`], { stdio: 'ignore', timeout: 30_000 }); break; } catch { /* 다음 크기 */ }
  }
  if (!existsSync(f)) throw new Error(`썸네일 받기 실패: ${s.src}`);
  s.src = `.make/yt${i}.jpg`;
  s.credit ??= 'TVING·KBO';
});
let footage = 0; // 지금까지 쓴 경기 영상 길이(초)
let lastBg: { src: string; at: number; still: boolean; credit?: string; motion?: boolean } | undefined; // 끝 장면 look 'profile' 배경용(글 없는 원본 화면)
const voice = (src: string, out: string) => ff('-i', join(DIR, src), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.18:stop_threshold=-45dB,atempo=1.18', '-ar', '44100', '-ac', '2', out);
const parts: string[] = [];
spec.segments.forEach((s, i) => {
  const a = join(TMP, `a${i}.wav`), ov = join(TMP, `o${i}.png`), v = join(TMP, `s${i}.mp4`);
  const clip = !isStill(s.src) && s.to !== undefined && s.from !== undefined ? Math.max(0.5, s.to - s.from) : undefined;
  let d = (clip ?? s.dur ?? 3).toFixed(2);
  if (hasVoice(s)) { try { voice(s.say!, a); d = Math.max(dur(a) + 0.25, 1.8).toFixed(2); } catch { console.error(`경고: 목소리 처리 실패, 음악만 — ${s.say}`); } }
  if (s.kind === 'motion') s.motion = true; // SCENES 장면표 표기 "kind":"motion" = motion: true
  // 남의 영상(credit·yt 가 있는 장면)에 motion 을 붙이면 '영상:' 표기와 39초 합계를 피해 가므로 막는다(규엔 2026-11-11)
  if (s.motion && (s.credit || (s as { yt?: string }).yt)) { console.error(`경고: ${i + 1}번 장면은 credit·yt 가 있는 경기 영상이라 motion 을 무시함 — ${s.src}`); s.motion = false; }
  const licensed = !s.motion && (!isStill(s.src) || !!s.credit); // 경기 영상 또는 그 썸네일(우리가 만든 모션 장면은 빼고)
  if (licensed) {
    const left = FOOTAGE_MAX - footage;
    if (Number(d) > left) { console.error(`경고: 경기 영상 합계 ${FOOTAGE_MAX}초 제한 — 이 장면을 ${Math.max(left, 0).toFixed(1)}초로 줄임`); d = Math.max(left, 0.5).toFixed(2); }
    footage += Number(d);
  }
  if (!existsSync(a)) ff('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', d, a);
  shot(page((s.head || s.kick || s.sub ? `<img class="logo" src="logo.webp">${s.kick ? `<span class="kick">${esc(s.kick)}</span>` : ''}${s.head ? `<h1>${head(s.head)}</h1>` : ''}${s.sub ? `<p class="sub">${esc(s.sub)}</p>` : ''}${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}` : '') + (licensed || s.motion ? `<p class="credit">영상: ${esc(s.motion ? '빠따닷컴 모션' : s.credit ?? 'TVING·KBO')}</p>` : ''), spec.subStyle === 'yt' ? 'yt' : ''), ov);
  const src = join(DIR, s.src), still = isStill(s.src);
  const live = !still && !!s.live && hasAudio(src);
  const base = !still && s.fit !== false && !s.motion
    ? `[0]split[p][q];[p]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.2[bg];[q]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2+120,fps=30,tpad=stop_mode=clone:stop_duration=10`
    : still && (s.fit || s.credit)
    ? `[0]split[p][q];[p]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.15[bg];[q]scale=1040:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30`
    : still
    ? `[0]scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.ceil(Number(d) * 30)}:s=1080x1920:fps=30`
    : `[0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=10`;
  const seek = !still && s.from !== undefined ? ['-ss', String(s.from)] : [];
  // 현장음: 목소리가 있으면 35%로 낮춰 깔고, 없으면 그대로
  const audio = live ? `[0:a]aresample=44100,volume=${hasVoice(s) ? 0.35 : 1},apad,atrim=0:${d}[la];[2]apad,atrim=0:${d}[va];[la][va]amix=inputs=2:duration=first:normalize=0[au]` : `[2]apad,atrim=0:${d}[au]`;
  // 장면 효과: 아무것도 없으면 그래프가 예전과 똑같다
  const end = Number(d), extra: string[] = [];
  const win = (c: Cue | undefined, def: number, name: string) => {
    if (!c) return undefined;
    const warn = (m: string) => console.error(`경고: ${i + 1}번 장면 ${name} ${m}`);
    if (typeof c.at !== 'number' || !(c.at >= 0 && c.at < end)) { warn(`시각 ${JSON.stringify(c.at)}가 숫자가 아니거나 장면 길이 ${d}초 밖 — 뺌`); return undefined; }
    if (c.dur !== undefined && !(typeof c.dur === 'number' && c.dur > 0)) { warn(`길이 ${JSON.stringify(c.dur)}가 0보다 큰 숫자가 아님 — 뺌`); return undefined; }
    const b = c.at + (c.dur ?? def);
    if (b > end && c.dur !== undefined) warn(`${c.at}+${c.dur}초가 장면 끝 ${d}초를 넘어 ${(end - c.at).toFixed(2)}초만 보임`);
    return [c.at, Math.min(b, end)] as const;
  };
  let g = `${base},trim=0:${d},setpts=PTS-STARTPTS`;
  const fr = win(s.freeze, 0.8, 'freeze');
  if (fr) g += `,split[z0][z1];[z0][z1]freezeframes=first=${Math.round(fr[0] * 30)}:last=${Math.max(Math.round(fr[1] * 30) - 1, Math.round(fr[0] * 30))}:replace=${Math.round(fr[0] * 30)}`;
  const zm = win(s.zoom, 1.5, 'zoom');
  if (zm) g += `,scale=2160:3840,zoompan=z='1+0.2*clip((on/30-${zm[0]})/${Math.max(zm[1] - zm[0], 0.1)},0,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30`;
  const sh = win(s.shake, 0.5, 'shake');
  if (sh) g += `,scale=1162:2066,crop=1080:1920:x='41+if(between(t,${sh[0]},${sh[1]}),30*sin(t*70),0)':y='73+if(between(t,${sh[0]},${sh[1]}),30*cos(t*90),0)'`;
  let n = 3; // 다음 입력 번호(0 화면, 1 글 그림, 2 목소리)
  const ln = win(s.lines, 0.8, 'lines');
  if (ln) { const png = join(TMP, `l${i}.png`); shot(page('<div class="lines"></div>'), png); extra.push('-i', png); g += `[l0];[l0][${n++}]overlay=enable='between(t,${ln[0]},${ln[1]})'`; }
  g += '[v];[v][1]overlay';
  (s.fx ?? []).forEach((f, k) => {
    const style = f.style && FX_MOVE[f.style] ? f.style : (f.style && console.error(`경고: 효과 자막 스타일 ${f.style} 없음 — pop 으로`), 'pop');
    const mv = FX_MOVE[style], w = win(f, mv.dur, `fx "${f.text}"`);
    if (!w) return;
    // 우영미 기준 글자 수(넘으면 pop·sfx 는 줄바꿈 없이 화면 밖으로 잘림)
    const len = [...f.text.replace(/<[^>]*>/g, '')].length, max = FX_MAX[style];
    if (len > max) console.error(`경고: ${i + 1}번 장면 fx "${f.text}" ${len}자 — ${style} 는 ${max}자 안쪽(넘으면 잘릴 수 있음)`);
    const okPos = Array.isArray(f.pos) && f.pos.length === 2 && f.pos.every((v) => typeof v === 'number' && Number.isFinite(v));
    if (f.pos !== undefined && !okPos && !(typeof f.pos === 'string' && f.pos in FX_POS)) console.error(`경고: ${i + 1}번 장면 fx "${f.text}" pos ${JSON.stringify(f.pos)} 를 못 읽음 — ${mv.pos} 로`);
    const [x, y] = okPos ? (f.pos as [number, number]) : FX_POS[(typeof f.pos === 'string' && f.pos in FX_POS ? f.pos : mv.pos) as keyof typeof FX_POS];
    // 글 가운데가 가장자리 100px 안이면 글이 잘려 보인다
    if (x < 100 || x > 980 || y < 100 || y > 1820) console.error(`경고: ${i + 1}번 장면 fx "${f.text}" pos [${x}, ${y}] 가 화면 가장자리라 글이 잘릴 수 있음`);
    const png = join(TMP, `f${i}_${k}.png`);
    shot(page(`<div class="fx ${style}" style="--cx:${x}px;--cy:${y}px${f.size ? `;font-size:${f.size}px` : ''}">${head(f.text)}</div>`), png);
    // 페이드는 시간에 따라 바뀌니 그림을 장면 길이만큼 늘려 넣는다
    extra.push(...(mv.fade ? ['-loop', '1', '-framerate', '30', '-t', d] : []), '-i', png);
    const [a0, a1] = w, on = (t0: number, t1: number) => `enable='gte(t,${t0.toFixed(3)})*lt(t,${t1.toFixed(3)})'`;
    const dx = mv.wob ? `+if(lt(t,${a0 + 0.25}),${mv.wob[0]}*sin((t-${a0})*${((2 * Math.PI * mv.wob[1]) / 0.25).toFixed(2)}),0)` : '';
    const dy = mv.drop ? `-${mv.drop}*max(0,1-(t-${a0})/0.15)` : '';
    const st = [...mv.s.map((sc, j) => [sc, a0 + j / 30] as const), [1, a0 + mv.s.length / 30] as const];
    const src = `p${k}`;
    g += `[c${k}];[${n++}]format=rgba${mv.fade ? `,fade=t=in:st=${a0}:d=0.15:alpha=1,fade=t=out:st=${Math.max(a1 - 0.15, a0)}:d=0.15:alpha=1` : ''},split=${st.length}${st.map((_, j) => `[${src}${j}]`).join('')}`;
    st.forEach(([sc, t0], j) => {
      const t1 = j + 1 < st.length ? Math.min(st[j + 1][1], a1) : a1;
      const inp = sc === 1 ? `${src}${j}` : `${src}${j}s`;
      if (sc !== 1) g += `;[${src}${j}]scale=${Math.round(1080 * sc)}:${Math.round(1920 * sc)}[${inp}]`;
      g += `;[c${k}${j ? `_${j}` : ''}][${inp}]overlay=x='${Math.round(x * (1 - sc))}${dx}':y='${Math.round(y * (1 - sc))}${dy}':${on(t0, t1)}${j + 1 < st.length ? `[c${k}_${j + 1}]` : ''}`;
    });
  });
  const fl = win(s.flash, 0.2, 'flash');
  if (fl) g += `,drawbox=c=white@0.85:t=fill:enable='between(t,${fl[0]},${(fl[0] + fl[1]) / 2})',drawbox=c=white@0.4:t=fill:enable='between(t,${(fl[0] + fl[1]) / 2},${fl[1]})'`;
  ff(...(still ? ['-loop', '1'] : seek), '-i', src, '-i', ov, '-i', a, ...extra, '-filter_complex', `${g},format=yuv420p[o];${audio}`, '-map', '[o]', '-map', '[au]', '-t', d, '-c:v', 'libx264', '-crf', '22', '-c:a', 'aac', '-ar', '44100', '-ac', '2', v);
  lastBg = { src, at: (s.from ?? 0) + Math.max(Number(d) - 0.1, 0), still, credit: licensed ? s.credit ?? 'TVING·KBO' : undefined, motion: !!s.motion };
  parts.push(v);
});
// 끝 마무리(2026-11-10 이사님: 끝 컷을 더 길게, 짧은 페이드아웃): outro 가 없으면 예전과 같다
const hold = typeof spec.outro?.hold === 'number' && spec.outro.hold > 0 ? spec.outro.hold : 0;
const fade = typeof spec.outro?.fade === 'number' && spec.outro.fade > 0 ? spec.outro.fade : 0;
if (spec.outro && (spec.outro.hold ?? 0) !== hold) console.error(`경고: outro.hold ${JSON.stringify(spec.outro.hold)} 를 못 읽음 — 0`);
if (spec.outro && (spec.outro.fade ?? 0) !== fade) console.error(`경고: outro.fade ${JSON.stringify(spec.outro.fade)} 를 못 읽음 — 0`);
if (hold && !spec.end) console.error('경고: 끝 장면(end)이 없어 outro.hold 는 안 씀');
if (spec.end) {
  const e = spec.end, ov = join(TMP, 'end.png'), v = join(TMP, 'send.mp4');
  for (const id of [e.a, e.b]) if (id && existsSync(join(ROOT, `public/mascots/emblem/${id}@2x.webp`))) ff('-i', join(ROOT, `public/mascots/emblem/${id}@2x.webp`), join(TMP, `${id}.png`));
  const box = (id?: string) => (id && TEAM[id] ? `<div style="background:${TEAM[id].color}"><img src="${id}.png">${esc(TEAM[id].name)}</div>` : '');
  // look 'profile'(2026-11-11 이사님, 빠따 매거진 마지막 장 참고): 앞 장면 마지막 화면을 어둡게 깔고 계정 이름·문구·프로필 카드(팔로우 버튼)를 얹는다. 숫자(팔로워 등)는 넣지 않는다
  const prof = e.look === 'profile', bg = join(TMP, 'endbg.png');
  if (prof && lastBg) ff(...(lastBg.still ? [] : ['-ss', String(lastBg.at)]), '-i', lastBg.src, '-frames:v', '1', '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', '-update', '1', bg);
  shot(page(prof
    ? `<div class="pbrand">빠따닷컴<small>@bbadda_officials</small></div><h1>${head(e.head)}</h1><div class="pcard"><img src="logo.webp"><div class="pname">빠따닷컴</div><div class="pid">@bbadda_officials</div><p class="pbio">${esc(e.cta)}</p><div class="pbtn"><span class="f">팔로우</span><span>메시지</span></div><span class="hand">👆</span></div><img class="plogo" src="logo.webp">${lastBg?.credit ? `<p class="credit">영상: ${esc(lastBg.credit)}</p>` : ''}`
    : `<img class="logo" src="logo.webp">${e.kick ? `<span class="kick">${esc(e.kick)}</span>` : ''}<h1>${head(e.head)}</h1>${e.a || e.b ? `<div class="vs">${box(e.a)}${box(e.b)}</div>` : ''}<p class="cta">${esc(e.cta)}<small>@bbadda_officials 팔로우</small></p>`, prof ? 'prof' : 'end'), ov);
  let d = '2.8';
  if (e.say) { voice(e.say, join(TMP, 'aend.wav')); d = Math.max(dur(join(TMP, 'aend.wav')) + 0.5, 2.8).toFixed(2); }
  if (hold > 0) d = (Number(d) + hold).toFixed(2);
  const bgIn = prof ? (existsSync(bg) ? ['-loop', '1', '-i', bg] : ['-f', 'lavfi', '-i', 'color=c=0x111111:s=1080x1920']) : [];
  ff(...bgIn, '-loop', '1', '-i', ov, ...(e.say ? ['-i', join(TMP, 'aend.wav')] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']), '-filter_complex', prof ? `[0]scale=1080:1920,boxblur=10:1,eq=brightness=${lastBg?.motion ? -0.62 : -0.4}:saturation=${lastBg?.motion ? 0.2 : 0.5},fps=30[b];[b][1]overlay,format=yuv420p[o];[2]apad,atrim=0:${d}[au]` : `[0]fps=30,format=yuv420p[o];[1]apad,atrim=0:${d}[au]`, '-map', '[o]', '-map', '[au]', '-t', d, '-c:v', 'libx264', '-crf', '22', '-c:a', 'aac', '-ar', '44100', '-ac', '2', v);
  parts.push(v);
}
writeFileSync(join(TMP, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
ff('-f', 'concat', '-safe', '0', '-i', join(TMP, 'list.txt'), '-c', 'copy', join(TMP, 'cat.mp4'));
const total = dur(join(TMP, 'cat.mp4'));
const music = join(ROOT, `scripts/insta/music/${spec.music ?? 'bgm-breaking'}.mp3`);
const cat = join(TMP, 'cat.mp4'), mix = join(TMP, 'mix.wav'), fadeAt = Math.max(total / SPEED - fade, 0).toFixed(2);
// 소리는 따로 만든 뒤 붙인다: loudnorm 을 영상 인코딩과 한 그래프에서 돌리면 ffmpeg 9 에서 소리가 3초씩 통째로 빠졌다(2026-11-11 save pool 3차). 48kHz 로 내보낸다(96kHz 는 일부 재생기에서 끊김)
ff('-i', cat, '-i', music, '-filter_complex', `[1]volume=${spec.segments.some((x) => x.live && !isStill(x.src)) ? 0.12 : spec.segments.some(hasVoice) ? 0.2 : 0.7},atrim=0:${total},afade=t=out:st=${Math.max(total - 1, 0)}:d=1[b];[0:a][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5,atempo=${SPEED}${fade ? `,afade=t=out:st=${fadeAt}:d=${fade}` : ''}[m]`, '-map', '[m]', '-ar', '48000', '-c:a', 'pcm_s16le', mix);
ff('-i', cat, '-i', mix, '-filter_complex', `[0:v]setpts=PTS/${SPEED}${fade ? `,fade=t=out:st=${fadeAt}:d=${fade}` : ''}[v]`, '-map', '[v]', '-map', '1:a', '-shortest', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', OUT);
// 소리 빈 구간 검사(규엔 avgap.py 와 같은 기준): 소리 패킷 시작 간격이 0.1초를 넘거나 소리·영상 길이가 0.1초 넘게 다르면 실패로 끝낸다(그 mp4 는 올리지 않는다)
const probe = (...a: string[]) => execFileSync('ffprobe', ['-v', 'error', ...a, '-of', 'csv=p=0', OUT]).toString().trim();
const apts = probe('-select_streams', 'a', '-show_entries', 'packet=pts_time').split('\n').map(Number).sort((x, y) => x - y);
const hole = apts.findIndex((t, k) => k > 0 && t - apts[k - 1] > 0.1);
const [vLen, aLen] = ['v', 'a'].map((st) => Number(probe('-select_streams', st, '-show_entries', 'stream=duration')));
if (hole > 0 || !(Math.abs(aLen - vLen) <= 0.1)) { console.error(`실패: 소리 ${hole > 0 ? `빈 구간 ${apts[hole - 1]}→${apts[hole]}초` : `길이 ${aLen}초 / 영상 ${vLen}초`} — ${OUT}`); process.exit(1); }
if (vLen > REEL_MAX) console.error(`경고: 릴스 길이 ${vLen.toFixed(1)}초 — ${REEL_MAX}초(2분) 상한을 넘음, 장면을 줄일 것`);
console.log(JSON.stringify({ out: OUT, seconds: Number((total / SPEED).toFixed(1)), footage: Number(footage.toFixed(1)) }));

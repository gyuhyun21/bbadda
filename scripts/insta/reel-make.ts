// 매일 릴스 조립(2026-10-24 주인 결정: 하루 1개 자동 릴스). 루틴(docs/reel-routine.md)이 만든 재료 폴더를 영상 하나로 합친다.
// 사용: npx tsx scripts/insta/reel-make.ts <재료 폴더> <출력 mp4>   (크롬: CHROME 환경변수, 없으면 google-chrome / ffmpeg 필요)
// 재료 폴더의 reel.json:
//   { music?: 'bgm-breaking', segments: [{ src: '1.mp4'|'1.png', say: 'a1.mp3', kick: '짧은 머리표', head: '큰 제목(<b>강조</b>, <br> 줄바꿈)', note?: '아래 작은 글(출처 등)' }],
//     end?: { kick, head, a?: 'kia', b?: 'samsung', cta: '롯데팬 친구한테 보내 줘', say?: 'a9.mp3' } }
// 장면 길이 = 그 장면 목소리 길이(쉼 0.18초·1.18배로 다듬은 뒤) + 0.25초(목소리가 없으면 dur, 기본 3초). 그림(png)은 천천히 확대, 영상은 길이에 맞춰 자르거나 늘린다.
// fit: true 인 그림(카드 이미지 등)은 자르지 않고 흐린 배경 위에 통째로 놓는다. 어떤 경우에도 영상은 만든다(그날 릴스를 빠뜨리지 않는다, 2026-10-24 주인).
// 경기 영상(2026-10-26 주인 결정, 티빙·KBO 허용 범위: 비영리·40초 미만): 영상 장면은 from·to(원본 초)로 구간을 고르고, live: true 면 현장음을 섞는다.
//   가로 영상은 기본으로 흐린 배경 위에 통째로 놓는다(fit: false 면 세로로 꽉 채워 자름). 경기 영상 합계는 FOOTAGE_MAX 초를 넘지 않게 자른다(넘으면 뒤 장면부터 줄임).
// 공식 영상 썸네일 장면(2026-10-26): src 에 i.ytimg.com 주소를 그대로 쓴다(파일을 저장소에 두지 않고 조립할 때만 받음, 고해상도가 없으면 hqdefault). 그림 파일에 credit(예 'TVING')을 주면 경기 영상의 한 장면으로 보고 — 흐린 배경 위에 통째로(로고·워터마크를 자르지 않음), 화면에 '영상: <credit>', 길이를 경기 영상 합계에 넣는다.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

type Seg = { src: string; say?: string; text?: string; kick?: string; head?: string; note?: string; dur?: number; fit?: boolean; from?: number; to?: number; live?: boolean; credit?: string };
const FOOTAGE_MAX = 39; // 티빙·KBO 허용 '40초 미만'보다 1초 여유
type End = { kick?: string; head: string; a?: string; b?: string; cta: string; say?: string };
const ROOT = process.cwd();
const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg || !outArg) { console.error('사용: reel-make.ts <재료 폴더> <출력 mp4>'); process.exit(1); }
const DIR = resolve(dirArg), OUT = resolve(outArg), TMP = join(DIR, '.make');
mkdirSync(TMP, { recursive: true });
const spec = JSON.parse(readFileSync(join(DIR, 'reel.json'), 'utf8')) as { music?: string; segments: Seg[]; end?: End };
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
for (const [f, to] of [['public/brand/bbadda-logo.webp', 'logo.webp'], ['public/fonts/pretendard/PretendardVariable.subset.woff2', 'font.woff2']]) copyFileSync(join(ROOT, f), join(TMP, to));

const CSS = `@font-face{font-family:P;src:url(font.woff2) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0} html,body{background:transparent} body{font-family:P;word-break:keep-all;width:1080px;height:1920px;position:relative;color:#fff}
body>*{position:absolute}
.logo{right:60px;top:80px;height:64px;background:#fff;border-radius:14px;padding:8px 14px}
.kick{left:70px;top:200px;font-size:42px;font-weight:800;padding:12px 24px;border-radius:14px;background:#ffe03a;color:#111}
h1{left:70px;right:60px;top:290px;font-size:112px;font-weight:900;line-height:1.12;letter-spacing:-.02em;text-shadow:0 0 18px rgba(0,0,0,.6),6px 6px 0 #111;-webkit-text-stroke:3px #111;paint-order:stroke fill}
h1 b{color:#ffe03a;font-weight:900}
.note{left:70px;bottom:70px;font-size:26px;opacity:.85;text-shadow:0 0 8px #000}
.credit{right:60px;bottom:150px;font-size:24px;opacity:.8;text-shadow:0 0 8px #000}
body.end{background:#ffe03a;color:#111}
.end .kick{top:300px;background:#111;color:#ffe03a;font-size:48px}
.end h1{top:400px;font-size:150px;color:#111;text-shadow:none;-webkit-text-stroke:0}
.vs{left:80px;right:80px;top:780px;display:flex;gap:30px}
.vs div{flex:1;height:420px;border:8px solid #111;border-radius:30px;box-shadow:14px 14px 0 #111;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:90px;font-weight:900;color:#fff}
.vs img{height:250px}
.cta{left:80px;right:80px;top:1320px;background:#111;color:#fff;border-radius:28px;padding:40px 46px;font-size:62px;font-weight:900;line-height:1.3}
.cta small{display:block;font-size:40px;font-weight:700;color:#ffe03a;margin-top:10px}`;
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
const voice = (src: string, out: string) => ff('-i', join(DIR, src), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.18:stop_threshold=-45dB,atempo=1.18', '-ar', '44100', '-ac', '2', out);
const parts: string[] = [];
spec.segments.forEach((s, i) => {
  const a = join(TMP, `a${i}.wav`), ov = join(TMP, `o${i}.png`), v = join(TMP, `s${i}.mp4`);
  const clip = !isStill(s.src) && s.to !== undefined && s.from !== undefined ? Math.max(0.5, s.to - s.from) : undefined;
  let d = (clip ?? s.dur ?? 3).toFixed(2);
  if (hasVoice(s)) { try { voice(s.say!, a); d = Math.max(dur(a) + 0.25, 1.8).toFixed(2); } catch { console.error(`경고: 목소리 처리 실패, 음악만 — ${s.say}`); } }
  const licensed = !isStill(s.src) || !!s.credit; // 경기 영상 또는 그 썸네일
  if (licensed) {
    const left = FOOTAGE_MAX - footage;
    if (Number(d) > left) { console.error(`경고: 경기 영상 합계 ${FOOTAGE_MAX}초 제한 — 이 장면을 ${Math.max(left, 0).toFixed(1)}초로 줄임`); d = Math.max(left, 0.5).toFixed(2); }
    footage += Number(d);
  }
  if (!existsSync(a)) ff('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', d, a);
  shot(page((s.head || s.kick ? `<img class="logo" src="logo.webp">${s.kick ? `<span class="kick">${esc(s.kick)}</span>` : ''}${s.head ? `<h1>${head(s.head)}</h1>` : ''}${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}` : '') + (licensed ? `<p class="credit">영상: ${esc(s.credit ?? 'TVING·KBO')}</p>` : '')), ov);
  const src = join(DIR, s.src), still = isStill(s.src);
  const live = !still && !!s.live && hasAudio(src);
  const base = !still && s.fit !== false
    ? `[0]split[p][q];[p]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.2[bg];[q]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2+120,fps=30,tpad=stop_mode=clone:stop_duration=10`
    : still && (s.fit || s.credit)
    ? `[0]split[p][q];[p]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.15[bg];[q]scale=1040:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30`
    : still
    ? `[0]scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.ceil(Number(d) * 30)}:s=1080x1920:fps=30`
    : `[0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=10`;
  const seek = !still && s.from !== undefined ? ['-ss', String(s.from)] : [];
  // 현장음: 목소리가 있으면 35%로 낮춰 깔고, 없으면 그대로
  const audio = live ? `[0:a]aresample=44100,volume=${hasVoice(s) ? 0.35 : 1},apad,atrim=0:${d}[la];[2]apad,atrim=0:${d}[va];[la][va]amix=inputs=2:duration=first:normalize=0[au]` : `[2]apad,atrim=0:${d}[au]`;
  ff(...(still ? ['-loop', '1'] : seek), '-i', src, '-i', ov, '-i', a, '-filter_complex', `${base},trim=0:${d},setpts=PTS-STARTPTS[v];[v][1]overlay,format=yuv420p[o];${audio}`, '-map', '[o]', '-map', '[au]', '-t', d, '-c:v', 'libx264', '-crf', '22', '-c:a', 'aac', '-ar', '44100', '-ac', '2', v);
  parts.push(v);
});
if (spec.end) {
  const e = spec.end, ov = join(TMP, 'end.png'), v = join(TMP, 'send.mp4');
  for (const id of [e.a, e.b]) if (id && existsSync(join(ROOT, `public/mascots/emblem/${id}@2x.webp`))) ff('-i', join(ROOT, `public/mascots/emblem/${id}@2x.webp`), join(TMP, `${id}.png`));
  const box = (id?: string) => (id && TEAM[id] ? `<div style="background:${TEAM[id].color}"><img src="${id}.png">${esc(TEAM[id].name)}</div>` : '');
  shot(page(`<img class="logo" src="logo.webp">${e.kick ? `<span class="kick">${esc(e.kick)}</span>` : ''}<h1>${head(e.head)}</h1>${e.a || e.b ? `<div class="vs">${box(e.a)}${box(e.b)}</div>` : ''}<p class="cta">${esc(e.cta)}<small>@bbadda_officials 팔로우</small></p>`, 'end'), ov);
  let d = '2.8';
  if (e.say) { voice(e.say, join(TMP, 'aend.wav')); d = Math.max(dur(join(TMP, 'aend.wav')) + 0.5, 2.8).toFixed(2); }
  ff('-loop', '1', '-i', ov, ...(e.say ? ['-i', join(TMP, 'aend.wav')] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']), '-filter_complex', `[0]fps=30,format=yuv420p[o];[1]apad,atrim=0:${d}[au]`, '-map', '[o]', '-map', '[au]', '-t', d, '-c:v', 'libx264', '-crf', '22', '-c:a', 'aac', '-ar', '44100', '-ac', '2', v);
  parts.push(v);
}
writeFileSync(join(TMP, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
ff('-f', 'concat', '-safe', '0', '-i', join(TMP, 'list.txt'), '-c', 'copy', join(TMP, 'cat.mp4'));
const total = dur(join(TMP, 'cat.mp4'));
const music = join(ROOT, `scripts/insta/music/${spec.music ?? 'bgm-breaking'}.mp3`);
ff('-i', join(TMP, 'cat.mp4'), '-i', music, '-filter_complex', `[1]volume=${spec.segments.some((x) => x.live && !isStill(x.src)) ? 0.12 : spec.segments.some(hasVoice) ? 0.2 : 0.7},atrim=0:${total},afade=t=out:st=${Math.max(total - 1, 0)}:d=1[b];[0:a][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[m]`, '-map', '0:v', '-map', '[m]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', OUT);
console.log(JSON.stringify({ out: OUT, seconds: Number(total.toFixed(1)), footage: Number(footage.toFixed(1)) }));

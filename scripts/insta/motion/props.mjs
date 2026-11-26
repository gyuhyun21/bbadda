// motion-render.sh 가 부른다: node props.mjs <template> <props.json> <초> <teams.yaml> → 정리한 props JSON 을 표준 출력으로.
// 틀린 props 는 오류(종료 1), 화면에서 넘칠 만한 글은 경고(표준 오류). 숫자는 바꾸지 않는다 — 글자로만 바꿔 그대로 넘긴다.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const [tpl, file, secArg, teamsFile] = process.argv.slice(2);
const seconds = Number(secArg);
const errs = [], warn = (m) => console.error(`경고: ${m}`);
let p;
try { p = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`오류: props JSON 을 읽지 못함 — ${e.message}`); process.exit(1); }
if (!p || typeof p !== 'object' || Array.isArray(p)) { console.error('오류: props 는 { ... } 객체여야 함'); process.exit(1); }

const str = (v, name, need = true) => {
  if (v === undefined || v === null || v === '') { if (need) errs.push(`${name} 없음`); return ''; }
  if (typeof v !== 'string' && typeof v !== 'number') { errs.push(`${name} 는 글자나 숫자`); return ''; }
  return String(v);
};
const long = (s, n, name) => { if ([...s].length > n) warn(`${name} 「${s}」 ${[...s].length}자 — ${n}자 넘으면 글자가 작아지거나 잘림`); };
const list = (v, name, lo, hi) => {
  if (!Array.isArray(v)) { errs.push(`${name} 는 배열`); return []; }
  if (v.length < lo || v.length > hi) errs.push(`${name} 는 ${lo}~${hi}개(지금 ${v.length}개)`);
  return v.slice(0, hi);
};

const out = { seconds };
if (tpl === 'stat') {
  out.value = str(p.value, 'value'); out.unit = str(p.unit, 'unit', false); out.label = str(p.label, 'label');
  if (p.prefix !== undefined) out.prefix = str(p.prefix, 'prefix', false);
  long(out.value + out.unit, 9, 'value+unit'); long(out.label, 14, 'label');
} else if (tpl === 'compare') {
  out.items = list(p.items, 'items', 2, 3).map((it, i) => {
    const o = { name: str(it?.name, `items[${i}].name`), value: str(it?.value, `items[${i}].value`), unit: str(it?.unit, `items[${i}].unit`, false) };
    if (it?.note) o.note = str(it.note, `items[${i}].note`, false);
    long(o.name, 8, `items[${i}].name`); long(o.value + o.unit, 8, `items[${i}].value+unit`); if (o.note) long(o.note, 22, `items[${i}].note`);
    if (!/\d/.test(o.value)) warn(`items[${i}].value 「${o.value}」 에 숫자가 없음 — 막대 길이를 모두 같게 그림`);
    return o;
  });
  // 단위는 unit 칸 + value 맨 앞 숫자 뒤 글자(「55억」의 억)를 합쳐 본다(BUG-BB432-1·BB433-1)
  const unitOf = (o) => (String(o.value).replace(/^\D*?-?\d[\d,]*(?:\.\d+)?/, '') + o.unit).trim();
  const units = out.items.map(unitOf);
  if (new Set(units).size > 1) warn(`items 단위가 서로 다름(${units.map((u) => u || '없음').join('·')}) — 막대 길이는 value 맨 앞 숫자로만 재므로 틀리게 그려짐. 같은 단위로 바꿔 넣는다`);
  // highlight: 이름(글자) 또는 1부터 센 순번(숫자). 빼면 가장 큰 값
  if (p.highlight !== undefined) {
    const h = typeof p.highlight === 'number' ? p.highlight - 1 : out.items.findIndex((o) => o.name === String(p.highlight));
    if (h < 0 || h >= out.items.length) errs.push(`highlight 「${p.highlight}」 가 items 이름이나 1~${out.items.length} 순번이 아님`); else out.highlight = h;
  }
} else if (tpl === 'rank') {
  if (p.title !== undefined) { out.title = str(p.title, 'title', false); long(out.title, 14, 'title'); }
  out.items = list(p.items, 'items', 3, 5).map((it, i) => {
    const o = { rank: str(it?.rank, `items[${i}].rank`), name: str(it?.name, `items[${i}].name`), value: str(it?.value, `items[${i}].value`) };
    long(o.name, 8, `items[${i}].name`); long(o.value, 6, `items[${i}].value`);
    return o;
  });
} else if (tpl === 'quiz') {
  out.clues = list(p.clues, 'clues', 2, 3).map((c, i) => { const s = str(c, `clues[${i}]`); long(s, 13, `clues[${i}]`); return s; });
  out.answer = str(p.answer, 'answer'); long(out.answer, 6, 'answer');
  out.revealAt = Number(p.revealAt);
  if (!Number.isFinite(out.revealAt) || out.revealAt < 1 || out.revealAt > seconds - 1) errs.push(`revealAt 는 1초 ~ (장면 길이 ${seconds}초 - 1초) 사이 숫자 — 정답이 1초는 보여야 함`);
} else if (tpl === 'board') {
  const teams = parse(readFileSync(teamsFile, 'utf8')).teams;
  const find = (k) => teams.find((t) => [t.id, t.short, t.name, t.nickname].some((x) => String(x).toLowerCase() === String(k).toLowerCase()));
  const cell = (v, name) => { const s = Array.isArray(v) ? v.map((x) => str(x, name)).join(', ') : str(v, name, false); if ([...s].length > 11) errs.push(`${name} 「${s}」 ${[...s].length}자 — 11자 넘으면 잘려 이름이 사라짐. 줄여 넣는다`); return s || '—'; };
  // 어두운 팀 색(KT·두산·롯데·키움 등)은 검은 바탕에서 안 보인다 — 밝기가 낮으면 흰 테두리를 굵게(BUG-BB432-3)
  const dark = (c) => { const n = parseInt(String(c).replace('#', ''), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]; return Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b) < 70; }; // 체감 밝기(HSP) — KT 0·롯데 32·두산 33·키움 48, 그다음 어두운 삼성 80
  out.rows = list(p.rows, 'rows', 1, 10).map((r, i) => {
    const t = find(r?.team);
    if (!t) errs.push(`rows[${i}].team 「${r?.team}」 를 config/teams.yaml 에서 못 찾음(id·짧은 이름·이름·애칭)`);
    return { team: t?.id ?? '', short: t?.short ?? '', color: t?.color ?? '#666', dark: dark(t?.color ?? '#666'), in: cell(r?.in, `rows[${i}].in`), out: cell(r?.out, `rows[${i}].out`) };
  });
  if (out.rows.length !== 10) warn(`rows ${out.rows.length}줄 — 10개 구단 표가 아님`);
  const ids = out.rows.map((r) => r.team).filter(Boolean);
  if (new Set(ids).size !== ids.length) errs.push('rows 에 같은 팀이 두 번');
} else { errs.push(`템플릿 이름 「${tpl}」 — stat·compare·rank·quiz·board 중 하나`); }

if (errs.length) { errs.forEach((e) => console.error(`오류: ${e}`)); process.exit(1); }
process.stdout.write(JSON.stringify(out));

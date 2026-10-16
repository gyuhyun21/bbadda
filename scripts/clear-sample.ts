// npm run clear-sample — sample: true 인 signal·호·칼럼만 지운다
import { rmSync, readdirSync, rmdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readJsonDir, readMarkdownDir, contentDir } from '../src/lib/fsdata.ts';
let n = 0;
for (const { file, data } of readJsonDir(contentDir('.', 'signals'))) if ((data as { sample?: boolean }).sample) { rmSync(file); n++; try { if (!readdirSync(dirname(file)).length) rmdirSync(dirname(file)); } catch {} }
for (const kind of ['issues', 'columns'] as const) for (const { file, data } of readMarkdownDir(contentDir('.', kind))) if ((data as { sample?: boolean } | null)?.sample) { rmSync(file); n++; }
console.log(`SAMPLE ${n}개 삭제`);

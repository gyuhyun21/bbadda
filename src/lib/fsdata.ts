// 파일시스템에서 콘텐츠를 읽는 헬퍼 (Astro 밖 스크립트용: collect / enrich / validate).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export type Loaded<T> = { file: string; data: T; body?: string; raw?: unknown };

const walk = (dir: string, ext: string): string[] => {
  if (!existsSync(dir)) return [];
  // 점으로 시작하는 파일(.gitkeep, macOS 가 exFAT 에 만드는 ._*)은 건너뛴다
  return readdirSync(dir).filter((name) => !name.startsWith(".")).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });
};

export function splitFrontmatter(text: string): { front: unknown; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { front: null, body: text };
  return { front: parse(m[1]), body: m[2] };
}

export function readJsonDir(dir: string): Loaded<unknown>[] {
  return walk(dir, '.json').map((file) => {
    try {
      return { file, data: JSON.parse(readFileSync(file, 'utf8')) as unknown };
    } catch (e) {
      return { file, data: { __parse_error: String(e) } as unknown };
    }
  });
}

export function readMarkdownDir(dir: string): Loaded<unknown>[] {
  return walk(dir, '.md').map((file) => {
    const { front, body } = splitFrontmatter(readFileSync(file, 'utf8'));
    return { file, data: front, body };
  });
}

export const contentDir = (root: string, kind: 'signals' | 'columns') => join(root, 'src', 'content', kind);

// 사진 보강: (1) 구글 뉴스 링크 → 원 기사 주소, (2) 원 기사의 대표 이미지 주소(og:image).
// 이미지 파일은 받지 않고 주소만 저장한다(사이트는 원 매체 서버에서 그대로 표시). robots.txt 를 지킨다.
// 대상: 요약을 쓴(화면에 나가는) 뉴스만 — 매체 사이트 접속을 최소로 한다.
import type { Signal } from '../../src/lib/schemas.ts';
import type { Ctx } from './util.ts';
import { decodeGoogleNewsUrl, gnewsArticleId } from './gnews_decode.ts';
import { extractOgImage } from './og_image.ts';

export type EnrichOpts = { resolve_google_news: boolean; og_image: boolean; max_items: number };
export type EnrichLog = { resolved: number; resolve_failed: number; images: number; image_failed: number; robots_blocked: number; skipped_over_limit: number };

/** robots.txt 의 'User-agent: *' 구역 Disallow 에 걸리면 false */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  const disallow: string[] = [];
  for (const raw of robots.split(/\r?\n/)) {
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(raw.split('#')[0].trim());
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === 'user-agent') applies = m[2].trim() === '*';
    else if (applies && key === 'disallow' && m[2].trim()) disallow.push(m[2].trim());
  }
  return !disallow.some((d) => path.startsWith(d));
}

export const needsEnrich = (s: Signal) => s.source_type === 'news' && s.summary_ko.trim() !== '' && !s.image;

export async function enrichSignals(ctx: Ctx, signals: Signal[], opts: EnrichOpts): Promise<{ signals: Signal[]; log: EnrichLog }> {
  const log: EnrichLog = { resolved: 0, resolve_failed: 0, images: 0, image_failed: 0, robots_blocked: 0, skipped_over_limit: 0 };
  const robots = new Map<string, string | null>();
  const allowed = async (url: string) => {
    const u = new URL(url);
    if (!robots.has(u.origin)) {
      try { robots.set(u.origin, await ctx.fetchText(`${u.origin}/robots.txt`)); } catch { robots.set(u.origin, null); } // 없음 = 허용
    }
    const txt = robots.get(u.origin);
    return txt ? robotsAllows(txt, u.pathname) : true;
  };
  const order = signals.filter(needsEnrich).sort((a, b) => b.scores.hot + b.scores.relevance - (a.scores.hot + a.scores.relevance));
  const targets = new Set(order.slice(0, opts.max_items).map((s) => s.id));
  log.skipped_over_limit = Math.max(0, order.length - targets.size);
  const out: Signal[] = [];
  for (const s of signals) {
    if (!targets.has(s.id)) { out.push(s); continue; }
    let url = s.url;
    if (opts.resolve_google_news && gnewsArticleId(url)) {
      try { const real = await decodeGoogleNewsUrl(ctx, url); if (real) { url = real; log.resolved++; } else log.resolve_failed++; } catch { log.resolve_failed++; }
    }
    let image: string | undefined;
    if (opts.og_image && !gnewsArticleId(url)) {
      try {
        if (await allowed(url)) { image = extractOgImage(await ctx.fetchText(url), url) ?? undefined; if (image) log.images++; else log.image_failed++; }
        else log.robots_blocked++;
      } catch { log.image_failed++; }
    }
    out.push({ ...s, url, ...(image ? { image } : {}) });
  }
  return { signals: out, log };
}

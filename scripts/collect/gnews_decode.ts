// Google News RSS 링크(news.google.com/rss/articles/<id>)를 원 기사 주소로 푼다.
// 1) 기사 페이지에서 서명(data-n-a-sg)과 타임스탬프(data-n-a-ts)를 읽고
// 2) batchexecute(Fbv4je/garturlreq) 호출 응답에서 원 주소를 꺼낸다.
// Google이 형식을 바꾸면 실패할 수 있으므로, 실패 시 원래 링크를 그대로 둔다.
import type { Ctx } from './util.ts';

const GN_HOST = 'news.google.com';

export function gnewsArticleId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== GN_HOST) return null;
    const m = /\/(?:rss\/)?(?:articles|read)\/([^/?#]+)/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function parseSignature(html: string): { sg: string; ts: string } | null {
  const sg = /data-n-a-sg="([^"]+)"/.exec(html)?.[1];
  const ts = /data-n-a-ts="([^"]+)"/.exec(html)?.[1];
  return sg && ts ? { sg, ts } : null;
}

export function batchBody(id: string, ts: string, sg: string): string {
  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`;
  return 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]));
}

/** batchexecute 응답 텍스트에서 원 주소를 꺼낸다. */
export function parseBatchResponse(text: string): string | null {
  const parts = text.split('\n\n');
  const body = parts.length > 1 ? parts[1] : parts[0];
  try {
    const outer = JSON.parse(body) as unknown[][];
    for (const row of outer) {
      if (Array.isArray(row) && typeof row[2] === 'string') {
        const inner = JSON.parse(row[2]) as unknown[];
        if (typeof inner[1] === 'string' && /^https?:\/\//.test(inner[1])) return inner[1];
      }
    }
  } catch {
    /* 형식 불일치 */
  }
  return null;
}

export async function decodeGoogleNewsUrl(ctx: Ctx, url: string): Promise<string | null> {
  const id = gnewsArticleId(url);
  if (!id) return null;
  let sig: { sg: string; ts: string } | null = null;
  for (const page of [`https://${GN_HOST}/articles/${id}`, `https://${GN_HOST}/rss/articles/${id}`]) {
    try {
      sig = parseSignature(await ctx.fetchText(page));
      if (sig) break;
    } catch {
      /* 다음 형식 시도 */
    }
  }
  if (!sig) return null;
  const text = await ctx.fetchText(`https://${GN_HOST}/_/DotsSplashUi/data/batchexecute`, {
    method: 'POST',
    body: batchBody(id, sig.ts, sig.sg),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  });
  return parseBatchResponse(text);
}

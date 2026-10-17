// 카카오(다음) 검색 API — 다음 카페·블로그의 팀 언급 글(팬 반응). 제목·링크·날짜·카페/블로그 이름 + 검색 미리보기 이미지 주소(thumbnail)만, 본문(contents) 저장 안 함.
// 인증: KAKAO_REST_KEY(로컬, 헤더 'Authorization: KakaoAK <키>' — Bearer 아님) 또는 KAKAO_AUTH=proxy(클라우드 시크릿이 dapi.kakao.com 에 같은 헤더 주입)
import { loadSources, loadTeams } from '../../src/lib/config.ts';
import { stripTags, type Ctx, type RawItem } from './util.ts';

const API = 'https://dapi.kakao.com/v2/search';
type Doc = { title: string; url: string; datetime: string; cafename?: string; blogname?: string; thumbnail?: string };

export function docToItem(d: Doc, target: 'cafe' | 'blog'): RawItem {
  return {
    source_type: 'community', source_name: target === 'cafe' ? `다음카페 ${d.cafename ?? ''}`.trim() : `블로그 ${d.blogname ?? ''}`.trim(),
    url: d.url, title: stripTags(d.title), published_at: d.datetime, via: 'fans',
    // 카카오 검색이 만든 미리보기 이미지(다음 검색 서버 주소). http 는 https 로 — 사이트가 https 라 섞이면 막힌다
    ...(d.thumbnail && /^https?:\/\//.test(d.thumbnail) ? { image: d.thumbnail.replace(/^http:/, 'https:') } : {}),
  };
}

export async function collectKakao(ctx: Ctx, override?: Record<string, any>) {
  const cfg = override ?? loadSources().kakao;
  const out = { items: [] as RawItem[], failures: [] as string[], requests: 0, filtered_ads: 0 };
  if (!cfg.enabled) return { ...out, skipped: 'disabled' };
  const proxy = ctx.env.KAKAO_AUTH === 'proxy';
  const key = ctx.env.KAKAO_REST_KEY;
  if (!proxy && !key) return { ...out, skipped: 'KAKAO_AUTH=proxy (또는 KAKAO_REST_KEY) 필요' };
  const headers = proxy ? undefined : { Authorization: `KakaoAK ${key}` };
  const ads = ((cfg.ad_patterns ?? []) as string[]).map((p) => new RegExp(p, 'i'));
  const badSource = ((cfg.exclude_source_patterns ?? []) as string[]).map((p) => new RegExp(p, 'i'));
  const seen = new Set<string>();
  const since = ctx.now.getTime() - 3 * 86400000;
  for (const target of (cfg.targets ?? ['cafe', 'blog']) as ('cafe' | 'blog')[]) {
    for (const t of loadTeams().teams) {
      for (let page = 1; page <= Number(cfg.max_pages ?? 1); page++) {
        try {
          out.requests++;
          const params = new URLSearchParams({ query: t.name, sort: 'recency', size: String(cfg.size ?? 30), page: String(page) });
          const data = JSON.parse(await ctx.fetchText(`${API}/${target}?${params}`, headers ? { headers } : undefined)) as { documents?: Doc[]; meta?: { is_end?: boolean } };
          const docs = data.documents ?? [];
          for (const d of docs) {
            if (!d.url || !d.title || !d.datetime || seen.has(d.url)) continue;
            seen.add(d.url);
            const it = { ...docToItem(d, target), query_teams: [t.id] };
            if (ads.some((r) => r.test(it.title)) || badSource.some((r) => r.test(it.source_name))) { out.filtered_ads++; continue; }
            out.items.push(it);
          }
          const oldest = Math.min(...docs.map((d) => Date.parse(d.datetime)).filter(Number.isFinite));
          if (data.meta?.is_end || !docs.length || oldest < since) break;
        } catch (e) {
          out.failures.push(`${target} "${t.name}" p${page}: ${(e as Error).message}`);
          break;
        }
      }
    }
  }
  return out;
}

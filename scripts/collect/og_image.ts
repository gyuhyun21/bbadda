// 기사 HTML의 대표 이미지 메타(og:image, twitter:image)를 찾는다. 이미지 파일은 받지 않는다.
const META = /<meta\b[^>]*>/gi;
const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];

export function extractOgImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 300_000);
  const found: Record<string, string> = {};
  for (const m of head.matchAll(META)) {
    const tag = m[0];
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase();
    const content = attr(tag, 'content');
    if (content && ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(key) && !found[key]) found[key] = content;
  }
  const raw = found['og:image:secure_url'] ?? found['og:image'] ?? found['og:image:url'] ?? found['twitter:image'] ?? found['twitter:image:src'];
  if (!raw) return null;
  try {
    const abs = new URL(raw.replace(/&amp;/g, '&').trim(), pageUrl);
    if (abs.protocol === 'http:') abs.protocol = 'https:'; // 혼합 콘텐츠 방지
    return abs.protocol === 'https:' ? abs.toString() : null;
  } catch {
    return null;
  }
}

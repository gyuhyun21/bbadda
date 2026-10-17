// 검색엔진용 사이트맵 — 홈·팀·날짜·소개 페이지
import type { APIRoute } from 'astro';
import { TEAMS, loadAll, daysOf } from '../lib/site.ts';

export const GET: APIRoute = async ({ site }) => {
  const days = daysOf((await loadAll()).signals);
  const paths = ['/', '/teams/', ...TEAMS.map((t) => `/teams/${t.id}/`), '/archive/', ...days.map((d) => `/days/${d}/`), '/about/'];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};

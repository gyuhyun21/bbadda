import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTeams, loadScoring } from '../src/lib/config.ts';
import { findTeams, classify, findPos } from '../scripts/collect/classify.ts';
import { dedupe } from '../scripts/collect/dedupe.ts';
import { buildFeeds, stripOutlet } from '../scripts/collect/news_rss.ts';
import { collectVertex, findDate, normalizeLink, cleanTitle } from '../scripts/collect/vertex.ts';
import { collectKakao, docToItem } from '../scripts/collect/kakao.ts';
import { channelRef, collectYouTube } from '../scripts/collect/youtube.ts';
import { captionSnippet, isTokenExpired, usernameOf } from '../scripts/collect/instagram.ts';
import type { Ctx, RawItem } from '../scripts/collect/util.ts';

const cfg = { teams: loadTeams().teams, scoring: loadScoring() };
const NOW = new Date('2026-10-19T06:00:00+09:00');
const raw = (title: string, over: Partial<RawItem> = {}): RawItem => ({ source_type: 'news', source_name: '테스트일보', url: `https://example.com/${encodeURIComponent(title)}`, title, published_at: '2026-10-15T00:00:00+09:00', via: 'team', ...over });

test('팀 판별: 정식 이름은 그대로, 짧은 이름은 야구 단어가 있을 때만', () => {
  assert.deepEqual(findTeams('LG 트윈스, 준PO 엔트리 발표', cfg), ['lg']);
  assert.deepEqual(findTeams('LG, 두산 꺾고 3연승', cfg), ['lg', 'doosan']);
  assert.deepEqual(findTeams('LG 신형 냉장고 출시', cfg), []);
  assert.deepEqual(findTeams('삼성전자 3분기 실적, 야구장 광고 확대', cfg), []);
  assert.deepEqual(findTeams('KT 농구단 개막 연승', cfg), []); // 다른 종목
  assert.deepEqual(findTeams('Kia Tigers win Game 1', cfg), ['kia']);
});
test('팀 판별: 라틴 별칭은 단어 단위', () => {
  assert.equal(findPos('NCAA 야구 결승', 'NC'), -1);
  assert.equal(findPos('NC, 신인 계약', 'NC'), 0);
});
test('모듈: 1팀=팀 소식, 2팀=라이벌, 0팀 리그 검색=리그, 0팀 팀 검색=버림, 팬 검색=팬 반응', () => {
  assert.deepEqual(classify(raw('KIA 타이거즈 엔트리 발표'), cfg), { module: 'team', team: 'kia', teams: ['kia'] });
  assert.equal(classify(raw('LG, KIA와 준플레이오프 격돌'), cfg)?.module, 'rivalry');
  assert.deepEqual(classify(raw('프로야구 역대 최다 관중', { via: 'league' }), cfg), { module: 'league', teams: [] });
  assert.equal(classify(raw('오스틴 결승포'), cfg), null);
  assert.equal(classify(raw('한화 이글스 직관 후기', { via: 'fans', source_type: 'community' }), cfg)?.module, 'fans');
  assert.equal(classify(raw('오늘 경기 하이라이트', { via: 'fans' }), cfg), null);
});
test('모듈: 구단 공식 채널 글은 제목에 팀이 없어도 그 팀, KBO 공식은 리그', () => {
  assert.deepEqual(classify(raw('경기 하이라이트', { source_type: 'youtube', team_hint: 'ssg', official: true }), cfg), { module: 'team', team: 'ssg', teams: ['ssg'] });
  assert.equal(classify(raw('주간 하이라이트', { source_type: 'youtube', team_hint: 'kbo', official: true, via: 'league' }), cfg)?.module, 'league');
});
test('중복: 같은 소식은 대표 1건 + also_in', () => {
  const a = raw('LG 트윈스 염경엽 감독 준PO 핵심은 김도영', { source_name: '연합뉴스', url: 'https://a.example/1' });
  const b = raw('LG 트윈스 염경엽 감독 "준PO 핵심은 김도영"', { source_name: '뉴시스', url: 'https://b.example/2' });
  const r = dedupe([a, b], []);
  assert.equal(r.kept.length, 1);
  assert.deepEqual(r.kept[0].also, [{ source_name: '뉴시스', url: 'https://b.example/2' }]);
});
test('뉴스 피드: 10팀 + 리그 검색어, 한국어 로케일', () => {
  const f = buildFeeds();
  assert.equal(f.filter((x) => x.via === 'team').length, 10);
  assert.ok(f.every((x) => x.url.includes('hl=ko') && x.url.includes('gl=KR')));
  assert.equal(new URL(f[0].url).searchParams.get('q'), '"LG 트윈스" OR LG트윈스 when:7d');
});

test('Vertex: 날짜 인식(메타 작성 시각·한국어·영문·상대 시간), 수정 시각은 무시', () => {
  assert.equal(findDate({ 'article:published_time': '2026-10-14T03:00:00Z' }, '', NOW), '2026-10-14T03:00:00.000Z');
  assert.equal(findDate(undefined, '2026. 10. 13. — 직관 후기', NOW), new Date('2026-10-13T00:00:00+09:00').toISOString());
  assert.equal(findDate(undefined, 'Oct 14, 2026 — Kia Tigers', NOW), '2026-10-14T00:00:00.000Z');
  assert.equal(findDate(undefined, '3일 전 ...', NOW), new Date('2026-10-16T00:00:00+09:00').toISOString()); // 'N일 전'은 그날 자정(KST)
  assert.equal(findDate(undefined, '5시간 전 ...', NOW), new Date(NOW.getTime() - 5 * 3600000).toISOString());
  assert.equal(findDate({ 'og:updated_time': '2026-10-14T03:00:00Z' }, '', NOW), undefined);
});
test('Vertex: 링크 정리(레딧 ?tl=ko, 겹친 &amp;, 빈 파라미터)와 제목 꼬리표', () => {
  assert.equal(normalizeLink('https://reddit.com/r/KBO/comments/abc/x/?tl=ko'), 'https://www.reddit.com/r/KBO/comments/abc/x/');
  assert.equal(normalizeLink('https://gall.dcinside.com/board/view/?id=baseball_new11&amp;amp;no=1&amp;page='), 'https://gall.dcinside.com/board/view/?id=baseball_new11&no=1');
  assert.equal(cleanTitle('한화 이글스 직관 후기 - MLBPARK'), '한화 이글스 직관 후기');
});
test('Vertex: 상대 날짜(N일 전) 글은 같은 날 여러 건이어도 남김', async () => {
  const fetchText: Ctx['fetchText'] = async () => JSON.stringify({ results: [1, 2, 3, 4].map((n) => ({ document: { derivedStructData: { title: `LG 트윈스 글 ${n}`, link: `https://mlbpark.donga.com/mp/b.php?id=${n}`, snippets: [{ snippet: '2일 전 직관' }] } } })) });
  const r = await collectVertex({ now: NOW, env: { VERTEX_AUTH: 'proxy', VERTEX_ENGINE: 'projects/1/locations/global/collections/default_collection/engines/bbadda' }, log: () => {}, fetchText },
    { enabled: true, max_queries: 1, sites: [{ host: 'mlbpark.donga.com', name: '엠엘비파크' }] });
  assert.equal(r.items.length, 4);
  assert.equal(r.dropped_suspect_date, 0);
});
test('Vertex: 날짜만 있는 글은 같은 날 여러 건이어도 남김', async () => {
  const fetchText: Ctx['fetchText'] = async () => JSON.stringify({ results: [1, 2, 3, 4].map((n) => ({ document: { derivedStructData: { title: `LG 트윈스 글 ${n}`, link: `https://mlbpark.donga.com/mp/b.php?id=${n}`, snippets: [{ snippet: '2026. 10. 15. 직관' }] } } })) });
  const r = await collectVertex({ now: NOW, env: { VERTEX_AUTH: 'proxy', VERTEX_ENGINE: 'projects/1/locations/global/collections/default_collection/engines/bbadda' }, log: () => {}, fetchText },
    { enabled: true, max_queries: 1, sites: [{ host: 'mlbpark.donga.com', name: '엠엘비파크' }] });
  assert.equal(r.items.length, 4);
  assert.equal(r.dropped_suspect_date, 0);
});
test('Vertex: orderBy=date, 쿼리마다 siteSearch 한 곳, 상한, 같은 날짜 3건은 의심 날짜로 버림', async () => {
  const bodies: any[] = [];
  const fetchText: Ctx['fetchText'] = async (_u, req) => {
    bodies.push(JSON.parse(req!.body!));
    return JSON.stringify({ results: [1, 2, 3].map((n) => ({ document: { derivedStructData: { title: `LG 트윈스 글 ${n}`, link: `https://mlbpark.donga.com/mp/b.php?id=${n}`, pagemap: { metatags: [{ 'article:published_time': '2026-10-14T03:12:45Z' }] } } } }))
      .concat([{ document: { derivedStructData: { title: 'LG 트윈스 다른 글', link: 'https://mlbpark.donga.com/mp/b.php?id=9', snippets: [{ snippet: '2026. 10. 15. 직관' }] } } } as any]) });
  };
  const r = await collectVertex({ now: NOW, env: { VERTEX_AUTH: 'proxy', VERTEX_ENGINE: 'projects/1/locations/global/collections/default_collection/engines/bbadda' }, log: () => {}, fetchText },
    { enabled: true, max_queries: 2, order_by: 'date', sites: [{ host: 'mlbpark.donga.com', name: '엠엘비파크' }] });
  assert.equal(r.requests, 2);
  assert.equal(bodies[0].orderBy, 'date');
  assert.equal(bodies[0].filter, 'siteSearch:"https://mlbpark.donga.com/*"');
  assert.equal(r.dropped_suspect_date, 3);
  assert.deepEqual(r.items.map((i) => i.title), ['LG 트윈스 다른 글']);
});
test('Vertex: 인증·엔진이 없으면 건너뜀', async () => {
  const f: Ctx['fetchText'] = async () => '{}';
  assert.match((await collectVertex({ now: NOW, env: {}, log: () => {}, fetchText: f }, { enabled: true })).skipped ?? '', /VERTEX_AUTH/);
});
test('카카오: KakaoAK 헤더(Bearer 아님), 광고 글 제외', async () => {
  const seen: (Record<string, string> | undefined)[] = [];
  const fetchText: Ctx['fetchText'] = async (_u, req) => { seen.push(req?.headers); return JSON.stringify({ documents: [{ title: '<b>LG 트윈스</b> 직관 후기', url: 'https://cafe.daum.net/x/1', datetime: '2026-10-18T10:00:00.000+09:00', cafename: '야구사랑' }, { title: 'LG 트윈스 유니폼 최저가', url: 'https://cafe.daum.net/x/2', datetime: '2026-10-18T10:00:00.000+09:00' }, { title: 'LG트윈스 와펜 주문', url: 'https://cafe.daum.net/x/3', datetime: '2026-10-18T10:00:00.000+09:00', cafename: '성포자수 010-1234-5678' }], meta: { is_end: true } }); };
  const r = await collectKakao({ now: NOW, env: { KAKAO_REST_KEY: 'k' }, log: () => {}, fetchText }, { enabled: true, targets: ['cafe'], ad_patterns: ['최저가'], exclude_source_patterns: ['010-?\\d{4}'] });
  assert.equal(seen[0]?.Authorization, 'KakaoAK k');
  assert.ok(r.items.some((i) => i.title === 'LG 트윈스 직관 후기' && i.source_name === '다음카페 야구사랑'));
  assert.ok(r.filtered_ads >= 2);
  assert.ok(!r.items.some((i) => i.url.endsWith('/3')));
});
test('YouTube: 채널 주소 해석, 키가 없으면 건너뜀', async () => {
  assert.deepEqual(channelRef('https://www.youtube.com/channel/UCAZQZdSY5_YrziMPqXi-Zfw'), { id: 'UCAZQZdSY5_YrziMPqXi-Zfw' });
  assert.deepEqual(channelRef('https://www.youtube.com/c/LGTwinsTV'), { forHandle: '@LGTwinsTV' });
  assert.deepEqual(channelRef('http://www.youtube.com/user/ncdinos'), { forUsername: 'ncdinos' });
  assert.deepEqual(channelRef('https://www.youtube.com/@KBO1982'), { forHandle: '@KBO1982' });
  assert.deepEqual(channelRef('https://www.youtube.com/kiabaseballclub'), { forHandle: '@kiabaseballclub', forUsername: 'kiabaseballclub' });
  assert.deepEqual(channelRef('https://www.youtube.com/user/heroesbaseballclub/'), { forUsername: 'heroesbaseballclub' });
  assert.match((await collectYouTube({ now: NOW, env: {}, log: () => {}, fetchText: async () => '{}' })).skipped ?? '', /YOUTUBE/);
});
test('인스타그램: 계정명, 캡션 12단어, 오류 190 = 만료', () => {
  assert.equal(usernameOf('https://www.instagram.com/lgtwinsbaseballclub/'), 'lgtwinsbaseballclub');
  assert.equal(captionSnippet('#LG #야구\n오늘 승리 감사합니다 팬 여러분 정말 고맙습니다 내일도 잠실에서 만나요 꼭 와주세요 사랑해요'), '오늘 승리 감사합니다 팬 여러분 정말 고맙습니다 내일도 잠실에서 만나요 꼭 와주세요…');
  assert.ok(isTokenExpired('HTTP 400: {"error":{"message":"Error validating access token","type":"OAuthException","code": 190}}'));
});
test('뉴스 제목 끝의 매체명(두 번 붙은 것 포함)을 뗀다', () => {
  assert.equal(stripOutlet('LG, 두산 꺾고 준PO 진출 - 머니투데이 - 머니투데이', '머니투데이'), 'LG, 두산 꺾고 준PO 진출');
  assert.equal(stripOutlet('제목 - 연합뉴스', '뉴시스'), '제목 - 연합뉴스');
});
test('해시태그: 본문에 팀이 있으면 본문만, 없으면 해시태그가 한 팀일 때만', () => {
  assert.deepEqual(classify(raw('[10.16 엘지 기아 준플 엔트리 발표!!] #엘지트윈스 #삼성라이온즈 #롯데자이언츠', { via: 'fans' }), cfg)?.teams, ['lg', 'kia']);
  assert.deepEqual(classify(raw('준PO 엔트리 발표 #LG트윈스 #삼성라이온즈 #두산베어스', { via: 'fans' }), cfg), null);
  assert.equal(classify(raw('오늘 직관 브이로그 #한화이글스 #야구', { via: 'fans' }), cfg)?.team, 'hanwha');
  assert.deepEqual(classify(raw('KIA에 7연패 중인 LG #LG트윈스 #KIA타이거즈 #삼성라이온즈', { via: 'fans' }), cfg)?.teams, ['kia', 'lg']);
});
test('팀 판별 완화: 제목에 팀이 없으면 검색어 팀(야구 단어 있을 때만), 표시 남김', () => {
  assert.deepEqual(classify(raw("'가을침묵' 씻은 오스틴, 가을야구서 깨어났다", { query_teams: ['lg'] }), cfg), { module: 'team', team: 'lg', teams: ['lg'], team_inferred: true });
  assert.equal(classify(raw('대전 신규 아파트 분양', { query_teams: ['hanwha'] }), cfg), null); // 야구 단어 없음
  assert.equal(classify(raw('여자배구 신생팀 창단, 시즌 준비', { query_teams: ['kiwoom'] }), cfg), null); // 다른 종목
  assert.equal(classify(raw('준PO 1차전 선발 발표', { query_teams: ['lg', 'kia'] }), cfg)?.module, 'rivalry');
  assert.equal(classify(raw('직관 후기 시구 대박', { via: 'fans', source_type: 'community', query_teams: ['kia'] }), cfg)?.module, 'fans');
  assert.equal(classify(raw('LG 트윈스 엔트리 발표', { query_teams: ['kia'] }), cfg)?.team, 'lg'); // 제목의 팀이 우선
});
test('공식발표: 언론 제목의 [오피셜]·[공식발표]', async () => {
  const { toSignal, ANNOUNCEMENT } = await import('../scripts/collect/classify.ts');
  assert.ok(ANNOUNCEMENT.test('[오피셜] NC 신인 12명 계약 완료'));
  assert.ok(ANNOUNCEMENT.test('두산, 김지우와 5억 계약 [공식발표]'));
  const r = raw('[오피셜] NC 신인 계약');
  assert.equal(toSignal(r, classify(r, cfg)!, '2026-W43', NOW, cfg).announcement, true);
});

import { gnewsArticleId } from '../scripts/collect/gnews_decode.ts';
import { extractOgImage } from '../scripts/collect/og_image.ts';
import { enrichSignals, robotsAllows } from '../scripts/collect/enrich.ts';
test('사진 보강: 구글 뉴스 id, og:image(상대 주소·http→https), robots.txt', () => {
  assert.equal(gnewsArticleId('https://news.google.com/rss/articles/CBMiABC?oc=5'), 'CBMiABC');
  assert.equal(gnewsArticleId('https://example.com/a'), null);
  assert.equal(extractOgImage('<meta property="og:image" content="/img/a.jpg">', 'https://news.example.com/x/1'), 'https://news.example.com/img/a.jpg');
  assert.equal(extractOgImage('<meta content="http://cdn.example.com/b.jpg" property="og:image">', 'https://e.com'), 'https://cdn.example.com/b.jpg');
  assert.equal(extractOgImage('<title>x</title>', 'https://e.com'), null);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /private', '/private/1'), false);
  assert.equal(robotsAllows('User-agent: GPTBot\nDisallow: /\nUser-agent: *\nDisallow:', '/news/1'), true);
});
test('사진 보강: 요약을 쓴 뉴스만, 이미지 주소만 저장', async () => {
  const base = { issue: '2026-W43', module: 'team' as const, team: 'lg', teams: ['lg'], source_type: 'news' as const, source_name: '예시일보', title: 't', published_at: '2026-10-15T00:00:00Z', collected_at: '2026-10-16T00:00:00Z', metrics: {}, scores: { hot: 50, relevance: 50 }, sentiment: 'neutral' as const };
  const fetched: string[] = [];
  const fetchText: Ctx['fetchText'] = async (url) => { fetched.push(url); if (url.endsWith('/robots.txt')) return 'User-agent: *\nDisallow: /admin'; return '<meta property="og:image" content="https://img.example.com/p.jpg">'; };
  const { signals, log } = await enrichSignals({ now: NOW, env: {}, log: () => {}, fetchText }, [
    { ...base, id: 'a', url: 'https://news.example.com/a', summary_ko: '요약.' },
    { ...base, id: 'b', url: 'https://news.example.com/b', summary_ko: '' },
  ], { resolve_google_news: true, og_image: true, max_items: 10 });
  assert.equal(signals[0].image, 'https://img.example.com/p.jpg');
  assert.equal(signals[1].image, undefined);
  assert.equal(log.images, 1);
  assert.ok(!fetched.includes('https://news.example.com/b'));
});

import { stripTags } from '../scripts/collect/util.ts';
test('제목 정리: 숫자·이름 형태 문자 참조를 푼다(카카오 &#34; 실측)', () => {
  assert.equal(stripTags('&#34;출혈과 부종은 잡힌 상태&#34; 3년 연속'), '"출혈과 부종은 잡힌 상태" 3년 연속');
  assert.equal(stripTags('<b>LG</b> &#x27;가을&#x27; &quot;야구&quot; &amp;amp; 끝'), "LG '가을' \"야구\" &amp; 끝");
});
test('카카오: 검색 미리보기 이미지 주소를 image 로(https), 없으면 비움', async () => {
  const { toSignal } = await import('../scripts/collect/classify.ts');
  const d = { title: '<b>롯데</b> 선발 5인', url: 'https://blog.example/1', datetime: '2026-10-17T09:00:00.000+09:00', blogname: '야구일기' };
  assert.equal(docToItem({ ...d, thumbnail: 'http://search1.kakaocdn.net/argon/130x130_85_c/abc' }, 'blog').image, 'https://search1.kakaocdn.net/argon/130x130_85_c/abc');
  assert.equal(docToItem({ ...d, thumbnail: '' }, 'blog').image, undefined);
  assert.equal(toSignal({ ...docToItem({ ...d, thumbnail: 'https://t.kakaocdn.net/x' }, 'blog') }, { teams: ['lotte'], team: 'lotte', module: 'fans' }, '2026-W42', NOW, cfg).image, 'https://t.kakaocdn.net/x');
});

test('커뮤니티 옛글: 글 번호로 걸러내고 엠엘비파크는 id 날짜', async () => {
  const { postNumber, mlbparkDate, dropOldByNumber } = await import('../scripts/collect/vertex.ts');
  assert.equal(postNumber('https://theqoo.net/square/4176076639'), 4176076639);
  assert.equal(postNumber('https://www.fmkorea.com/index.php?mid=ib&document_srl=10447927414'), 10447927414);
  assert.equal(mlbparkDate('https://mlbpark.donga.com/mp/b.php?b=bullpen&id=202610090119282088'), '2026-10-08T15:00:00.000Z');
  const it = (url: string) => ({ source_type: 'community', source_name: 'x', url, title: 't', published_at: '2026-10-18T00:00:00Z' }) as any;
  const kept = dropOldByNumber([it('https://theqoo.net/square/4176076639'), it('https://theqoo.net/square/4378567038')], 15);
  assert.deepEqual(kept.map((k: any) => k.url), ['https://theqoo.net/square/4378567038']);
  // 이번 실행에 옛글만 있어도 이미 모은 글 번호로 거른다
  assert.equal(dropOldByNumber([it('https://theqoo.net/square/4176076639')], 15, ['https://theqoo.net/kbaseball/4377429044']).length, 0);
});

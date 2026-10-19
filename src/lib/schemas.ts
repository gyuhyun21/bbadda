// 콘텐츠 스키마. Astro 콘텐츠 컬렉션과 scripts/validate.ts 가 같은 정의를 쓴다.
import { z } from 'astro/zod';

// 모듈: 팀 소식(공식·언론) / 팬 반응(YouTube·커뮤니티) / 라이벌·순위 경쟁(2팀 이상) / 리그 전체(KBO 제도·일정·중계·흥행)
export const MODULES = ['team', 'fans', 'rivalry', 'league'] as const;
export const SOURCE_TYPES = ['news', 'youtube', 'instagram', 'community'] as const;
export const SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed'] as const;

export const weekId = z.string().regex(/^\d{4}-W\d{2}$/, 'YYYY-Www 형식이어야 합니다');
const score = z.number().min(0).max(100);
// Astro frontmatter 파서는 따옴표 없는 YYYY-MM-DD 를 Date 로 바꾸므로 문자열로 통일한다.
const dateStr = z.union([z.string(), z.date()]).transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10)));

export const signalSchema = z.object({
  id: z.string().min(1),
  // 보관 폴더(주 단위, src/content/signals/<YYYY-Www>/). 화면은 날짜 기준이라 이 값은 보관용이다.
  issue: weekId,
  module: z.enum(MODULES),
  // 대표 팀(제목에서 가장 먼저 나온 팀). 리그 전체 소식은 없을 수 있다.
  team: z.string().optional(),
  // 제목에 나온 모든 팀
  teams: z.array(z.string()).default([]),
  source_type: z.enum(SOURCE_TYPES),
  // 구단·KBO 공식 채널에서 온 글(오피셜)
  official: z.boolean().optional(),
  // 언론이 전한 구단·KBO 공식 발표(제목의 [오피셜]·[공식발표])
  announcement: z.boolean().optional(),
  // 제목에 팀 이름이 없어 검색어의 팀으로 정한 글(편집 때 확인)
  team_inferred: z.boolean().optional(),
  source_name: z.string(),
  url: z.string().url(),
  title: z.string().min(1),
  // 원제가 한국어가 아닐 때 붙이는 한국어 제목(카드에 먼저, 원제는 작게)
  title_ko: z.string().optional(),
  published_at: z.string(),
  collected_at: z.string(),
  // 우리가 쓴 요약 2문장 이내. 수집 직후에는 비어 있고 루틴이 채운다. 비어 있으면 화면에 나오지 않는다.
  summary_ko: z.string().default(''),
  // 인스타 아침 카드용 한 줄(우리 문장, 24자 이내, 명사형). 아침 실행에서 구단별 대표 뉴스에만 루틴이 쓴다
  brief_ko: z.string().max(30).optional(),
  // 검색 결과 발췌 15단어 이내(편집 참고용, 화면에 쓰지 않는다)
  excerpt: z.string().optional(),
  // 화면에 싣는 인용 15단어 이내. 출처는 url.
  quote: z.string().optional(),
  // 수집된 글에 쓰인 팬 은어(일부러 찾지 않는다)
  slang: z.string().optional(),
  // 원 기사의 대표 이미지 주소(og:image). 파일은 저장하지 않고 원 매체 서버 주소로 표시한다.
  image: z.string().url().optional(),
  also_in: z.array(z.object({ source_name: z.string(), url: z.string().url() })).optional(),
  metrics: z.object({ views: z.number().optional(), likes: z.number().optional(), comments: z.number().optional() }).default({}),
  scores: z.object({ hot: score, relevance: score }),
  sentiment: z.enum(SENTIMENTS).default('neutral'),
  sample: z.boolean().optional(),
});
export type Signal = z.infer<typeof signalSchema>;

export const columnSchema = z.object({
  title: z.string(),
  issue: weekId.optional(),
  team: z.string().optional(),
  published_at: dateStr,
  evidence: z.array(z.string()).min(1, '근거 signal 이 1개 이상 필요합니다'),
  status: z.enum(['draft', 'published']),
  sample: z.boolean().optional(),
});
export type Column = z.infer<typeof columnSchema>;

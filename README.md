# BBADDA (빠따닷컴)

KBO 10개 구단 팀별 소식 매거진 — bbadda.com. Astro 정적 사이트 + 저장소 안의 파일(JSON/Markdown/YAML). DB·로그인·유료 API 없음.
작업 규칙은 `CLAUDE.md`, 정기 실행 프롬프트는 `docs/routine.md`, 키·배포·도메인 설정은 `docs/setup.md`.

## 빠른 시작

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # astro build + Pagefind 검색 색인
npm test
npm run validate
```

Node 22.12+ 필요.

## 설정

| 파일 | 내용 |
|---|---|
| `config/teams.yaml` | 10개 구단: id, 이름, 짧은 이름, 연고지, 팀 컬러(TODO), 공식 사이트·YouTube·인스타그램(확인한 것만), 뉴스 검색어, 별칭 |
| `config/site.yaml` | 화면 스위치: `layout`(magazine/classic), `community_section`, `news_images`(뉴스 사진 원 주소 표시, 환경변수 `SITE_NEWS_IMAGES=on|off` 우선) |

**레이아웃 되돌리기**: `config/site.yaml` 의 `layout` — `apple`(기본, 애플 디자인 지침 적용, `src/styles/apple.css` 의 `.layout-apple` 아래) → `magazine`(이전 화면) → `classic`(단순 지면). 한 줄 바꿔 머지하면 된다. 배포 환경변수 `SITE_LAYOUT` 이 파일 값보다 우선한다. 커뮤니티 섹션은 `community_section`(환경변수 `SITE_COMMUNITY=on|off`). 첫 화면은 `home: front|simple`(환경변수 `SITE_HOME` 우선).

## 화면

| 주소 | 내용 |
|---|---|
| `/` | `home: front`(기본): 오늘의 헤드라인 → 내 팀 → 10개 구단 한눈에 → 가을야구·스토브리그(시즌별 제목) → 오피셜 영상 → 팬 반응 → 날짜별 소식. `home: simple`: 팀 선택 + 최근 소식 격자 |
| `/days/<날짜>` | 그날 게시된 소식: 리그·라이벌 → 팀별(내 팀이 맨 위), 전날·다음 날 넘기기 |
| `/teams/<id>` | 팀 페이지: 오피셜, 최근 소식(매일 갱신), 팬 반응, 은어, 날짜별 |
| `/archive`, `/search`, `/about` | 날짜별 소식(월별), 검색(Pagefind), 소개 |

- 내 팀: 팀 칩을 누르면 브라우저 localStorage(`bbadda:myTeam`)에 저장. 막혀 있으면 기본 화면.
- 요약(`summary_ko`)이 없는 signal 은 화면에 나오지 않는다(선별 전 수집분).
- 화면 확인용 SAMPLE: `npx tsx scripts/dev/make-sample.ts` → 확인 후 `npm run clear-sample`.

## 수집

```bash
npm run collect                          # src/content/signals/<YYYY-Www>/ 에 저장(주 단위 보관 폴더)
npm run collect -- --only=news_rss --dry # 한 소스만, 저장 없이
npm run collect -- --week=2026-W43 --as-of=2026-10-16T06:37:00+09:00   # 지난 날짜를 나중에 채울 때
npm run enrich                           # 요약한 뉴스에 원 기사 주소·대표 사진 주소
```

| 소스 | 키 | 비고 |
|---|---|---|
| 구글 뉴스 RSS | 없음 | 팀별 검색어 × 한국어 로케일 + 리그 검색어. 제목에 팀 이름이 없으면 버림 |
| YouTube Data API | `YOUTUBE_API_KEY` 또는 `YOUTUBE_AUTH=proxy` | 구단·KBO 공식 채널 + 팀 이름 검색(팬 영상). `units_budget` 상한 |
| 카카오(다음) 검색 | `KAKAO_REST_KEY` 또는 `KAKAO_AUTH=proxy` | 다음 카페·블로그. 헤더 `Authorization: KakaoAK <키>` |
| Instagram | `INSTAGRAM_USER_ID` + `INSTAGRAM_TOKEN` 또는 `INSTAGRAM_AUTH=proxy` | 구단 공식 비즈니스 계정. 60일 토큰, 오류 190 = 만료 |
| Vertex AI Search | `VERTEX_ENGINE` + `VERTEX_API_KEY` 또는 `VERTEX_AUTH=proxy` | 커뮤니티(엠엘비파크·디시·더쿠·에펨·레딧). 월 1만 회 무료, `max_queries` 상한 |

- 팀 판별은 제목에서만. 짧은 이름(LG·삼성·KT 등)은 제목에 야구 단어(`scoring.yaml baseball_terms`)가 있고 다른 종목 단어가 없을 때만 인정, 모기업 기사는 `teams.yaml exclude_any` 로 뺀다.
- 같은 소식은 대표 1건 + `also_in`. 팀·모듈별 주간 상한은 `sources.yaml`.
- 로그: `logs/collect-<호>.json`(실행마다 `runs` 에 덧붙음).
- 해 보니 안 되던 것(Weekly HUROM): Brave 검색은 최근 커뮤니티 글 0건, 구글 Programmable Search 는 신규 고객을 받지 않음, 커뮤니티 인기글 모음 사이트는 403.

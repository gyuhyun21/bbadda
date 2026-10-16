# BBADDA (빠따닷컴)

KBO 10개 구단 팀별 소식 매거진 — bbadda.com. Astro 정적 사이트 + 저장소 안의 파일(JSON/Markdown/YAML). DB·로그인·유료 API 없음.
작업 규칙은 `CLAUDE.md`.

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
| `config/site.yaml` | 화면 스위치: `layout`(magazine/classic), `community_section` |

**레이아웃 되돌리기**: `config/site.yaml` 의 `layout: magazine` 을 `classic` 으로 바꿔 머지하면 단순 지면 화면으로 돌아간다. 매거진 규칙은 모두 `src/styles/magazine.css` 의 `.layout-magazine` 아래에만 있다. 배포 환경변수 `SITE_LAYOUT` 이 파일 값보다 우선한다. 커뮤니티 섹션은 `community_section`(환경변수 `SITE_COMMUNITY=on|off`).

## 화면

| 주소 | 내용 |
|---|---|
| `/` | 내 팀이 있으면 그 팀 최근 소식이 맨 위, 없으면 팀 칩 10개. 이어서 최신 주간호 |
| `/teams/<id>` | 팀 페이지: 최근 소식(매일 갱신), 공식 채널 영상, 팬 반응, 은어, 지난 호 |
| `/issues/<주차>` | 주간호: 헤드라인 → Editor's Brief → 리그 전체 → 팀별 섹션(접기, 내 팀이 맨 위) → Community |
| `/archive`, `/search`, `/about` | 지난 호, 검색(Pagefind), 소개 |

- 내 팀: 팀 칩을 누르면 브라우저 localStorage(`bbadda:myTeam`)에 저장. 막혀 있으면 기본 화면.
- 요약(`summary_ko`)이 없는 signal 은 화면에 나오지 않는다(선별 전 수집분).
- 화면 확인용 SAMPLE: `npx tsx scripts/dev/make-sample.ts` → 확인 후 `npm run clear-sample`.

# 인스타 매일 점검 루틴(2026-10-26 주인 결정: 주 1회 → 매일)

claude.ai 루틴 'BBADDA 인스타 점검(매일)'이 매일 09:41 KST 에 아래 프롬프트를 실행한다.
재료: `ig-insights.yml`(08:53, 우리 계정 성과 → insta-media `stats/<날짜>.json`), `ig-research.yml`(09:07, 경쟁 계정 → insta-media `research/<날짜>.json`).
결과: `docs/insta-log.md` 맨 위에 그날 항목. 릴스 루틴(`docs/reel-routine.md`)이 그 '지금 적용'을 따른다.

```
너는 BBADDA(빠따닷컴) 인스타 담당이다. CLAUDE.md, docs/insta-style.md, docs/reel-routine.md, docs/insta-log.md, 이 문서를 읽고 따른다.

0. 오늘(KST) 날짜 D. docs/insta-log.md 에 "## D" 항목이 이미 있으면 끝낸다.
   git fetch origin +refs/heads/insta-media:refs/remotes/origin/insta-media 후 git show 로 읽는다:
   stats/ 최근 7일(없는 날은 건너뜀), research/ 가장 최근 파일. 오늘 stats 가 없으면 "자료 없음"만 요약하고 PR 없이 끝낸다.
1. 우리 계정(오늘 stats):
   - 게시물마다 조회(views)·도달(reach)·저장·공유·반응, 릴스는 평균 시청(ig_reels_avg_watch_time, ms → 초).
   - 어제보다 늘어난 조회(같은 id 의 전날 stats 와 비교)로 '지금도 퍼지는 것'을 찾는다.
   - 릴스를 칸(아침·밤 — 게시 시각)·첫 줄 후킹 패턴(insta-style 2절·2-1절)·첫 장면 종류(썸네일 경기 장면/그림)·길이로 나눠 본다. 표본이 3개 미만인 칸은 '판단 보류'.
2. 경쟁 계정(research): 계정 중앙값 3배 이상 조회 릴스의 첫 줄(40자)·형식. 우리에게 옮길 수 있는 것만(경기 장면 정지 화면 + 숫자 후킹 등). 그 계정 게시물 본문·영상을 가져오지 않는다.
3. 판단(하나씩만 바꾼다):
   - 이번에 바꿀 변수 하나(후킹 패턴, 첫 장면 종류, 길이, 주제 비중 중)와 근거 숫자. 근거 없는 감은 쓰지 않는다.
   - 같은 결론이 3일 연속이면 docs/insta-style.md 의 해당 절(2-1절 예시·11절 구성)에 반영한다(날짜·근거 함께).
   - 게시 시각·개수·자동화(코드·워크플로·루틴 시간) 변경은 고치지 않고 PR 본문 맨 위 '제안'에 적는다.
   - CLAUDE.md·저작권 규칙(insta-style 6·11절)은 바꾸지 않는다.
4. docs/insta-log.md 맨 위(제목 아래)에 "## D" 항목을 넣는다:
   - 표: 최근 7일 릴스 상위 3·하위 3(날짜·칸·첫 줄 20자·조회·평균 시청·저장+공유) [계산:insta-media stats/D.json]
   - 경쟁 아웃라이어 3줄 [계산:insta-media research/D.json]
   - 판단 2~4줄
   - "지금 적용:" 오늘 릴스 3개(아침·오후·저녁)가 따를 것 3줄 이내(예: "첫 장면은 경기 장면 썸네일 + 숫자 한 개", "저녁 칸은 결과 → 승부처 숫자 순").
   30일 지난 항목은 지운다.
5. 브랜치 daily/D-insta-review → PR(제목 "인스타 점검 (D)", 본문 = 그날 항목 + 제안) → npm run validate·npm test·npm run build 통과하면 머지(merge commit). docs/insta-log.md·docs/insta-style.md 말고는 고치지 않는다.
6. 끝나면 한 단락 요약: 오늘 바꾼 것, 근거 숫자, PR 링크.
```

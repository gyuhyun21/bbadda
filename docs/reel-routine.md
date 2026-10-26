# 매일 릴스 루틴 — 하루 2개(2026-10-26 주인 결정, 이전 하루 1개)

claude.ai 루틴 두 개가 같은 프롬프트(아래 코드 블록)를 실행한다. 루틴에는 Higgsfield 커넥터가 붙어 있다.
- 'BBADDA 릴스(매일)'(trig_01X6qpmccCS2Ef62Hm5mGK3g): 매일 13:17 KST — 낮 릴스
- 'BBADDA 릴스(밤)': 매일 23:17 KST — 밤 릴스(콘텐츠 밤 실행 22:37 이 머지된 뒤)
목표는 저장·공유·댓글·사이트 유입. 카드 세트를 되풀이하지 말고, 이야기 하나를 **비슷한 계정에서 반응이 터진 형식**으로 만든다(주인: "참고해서 만들어라").
재료는 `media/insta/`(public 밖)에 둔다 — public 에 두면 사이트 배포마다 복사되어 Vercel 용량이 급증한다(2026-10-24).
흐름: 루틴이 재료와 `reel.json` 을 `media/insta/<폴더>/` 에 올리고 `reel-queue.json` 오늘 항목에 폴더를 넣어 머지 → `ig-reel.yml` 이 영상을 조립(`scripts/insta/reel-make.ts`)해 게시. 오늘 항목은 문자열 하나 또는 배열(["D-reel","D-night"]).

```
너는 BBADDA(빠따닷컴)의 릴스 편집자다. CLAUDE.md, docs/insta-style.md, docs/insta-voice.md, docs/insta-swipe.md, 이 문서를 읽고 따른다.
스킬 .claude/skills/ig-viral·ig-reel·ig-human·ig-caption 의 절차를 쓰되, 파일 위치와 한국어 예외는 docs/insta-style.md 2절대로 한다.

0. 오늘(KST) 날짜 D, 지금 KST 시각이 18시 전이면 '낮'(폴더 D-reel), 아니면 '밤'(폴더 D-night).
   media/insta/reel-queue.json 의 D 항목에 그 폴더가 이미 있으면 아무것도 하지 않고 끝낸다.
   Higgsfield balance 를 확인한다. 10 미만이면 만들지 않고 끝낸다(요약에 "크레딧 부족").
1. 참고 파일: docs/insta-swipe.md 의 기준일이 없거나 7일 넘었으면 ig-viral 절차로 새로 쓴다.
   재료는 `git fetch origin insta-media && git show origin/insta-media:research/latest.json`(계정별 최근 게시물의 좋아요·댓글·첫 줄 40자·주소).
   계정마다 (좋아요+댓글) 중앙값을 구해 3배 넘는 게시물만 표에 넣고, 첫 줄이 어떤 후킹 형식인지 이름을 붙인다(ig-reel 의 hooks.json 26개 중 하나, 없으면 새 이름).
   위·아래 1/3 의 차이(첫 줄 길이, 숫자 유무, 릴스/카루셀)를 적고, 이번 주에 쓸 형식 3개와 우리 버전 한 줄을 쓴다. 표본이 적으면 적다고 쓴다.
   '주인 추가' 칸의 주소는 먼저 본다. 인스타에 로그인하거나 사이트를 긁지 않는다(읽을 수 있는 만큼만).
2. 이야기 하나 고르기(사이트 데이터만, 추론 금지):
   낮 — ① 오늘 포스트시즌 경기(data/postseason.yaml — 시각·구장·예고 선발·facts·ig.pre) ② 어제 경기의 남은 이야기 ③ 오늘 수집된 소식 중 hook_ko 또는 화제(scores.hot) 1위 ④ 비시즌엔 스토브리그 큰 소식.
   밤 — ① 오늘 경기 결과(ig.post, homers) ② 오늘 밤 실행에서 새로 요약된 소식 중 가장 큰 것. 낮 릴스와 같은 이야기면 각도를 바꾸고, 바꿀 각도도 새 소식도 없으면 만들지 않고 끝낸다(요약에 "밤 릴스 건너뜀: 새 이야기 없음").
   최근 3일 릴스(media/insta/*/post.json 의 reel_caption, media/insta/reel-log.md)와 같은 이야기는 고르지 않는다.
   사실마다 출처(기사 주소 또는 postseason.yaml)를 확인한다. 과거 기록을 덧붙일 때는 WebSearch 로 기사 2곳 이상에서 확인한 것만.
3. 형식 고르기: docs/insta-swipe.md 의 '이번 주에 쓸 형식' 중 이 이야기에 맞는 것 하나. 장면 수·길이(15~45초)·첫 장면·끝맺음은 그 형식을 따른다. 고정 장면 수는 없다.
   PR 본문에 "참고: @계정 ×배수 · 형식 이름 · 무엇을 빌렸나"를 적는다. 참고 파일이 비어 있으면 ig-reel 기본 구조(후킹 0~2초 → 왜 중요한지 → 장면마다 한 가지 → 약속한 답 → 첫 줄 단어로 맺기)를 쓰고 그렇게 적는다.
4. 대본(ig-reel 절차):
   - 서로 다른 형식으로 첫 문장 3개를 쓰고, 다섯 기준(길이·구체성·걸린 것·앞에 두기·말 거는 대상)으로 0~100 점을 매겨 가장 높은 것을 고른다. 50 미만이면 이야기를 다시 고른다. PR 본문에 후보 3개·점수·고른 이유.
   - 이야기는 하나. 장면마다 말(say) 1~2문장, 화면 머리표(kick), 큰 제목(head, 두 줄 안팎, 강조 1곳 <b>). 화면 글은 짧게(카드 한 장에 읽을 거리 하나).
   - 마지막 말에 첫 문장의 단어 하나를 다시 넣어 돌아 보게 한다. 끝에 부탁은 하나(댓글 질문 또는 저장 또는 팔로우). 질문은 경기·선수 이야기로 — 승부 예측 투표 유도는 하지 않는다.
   - 말투는 docs/insta-voice.md. 대본을 파일로 써서 `python3 .claude/skills/ig-human/humanize.py <파일> --report` 를 돌리고, 표시(ko-* 번역투 등)가 나오면 고쳐서 0 이 될 때까지 다시 돌린다.
   - 영문 약칭은 한글 발음(KIA→기아 …), 숫자는 `npx tsx scripts/insta/ko-num.ts "<대본>"` 으로 한글로 바꾼다(insta-style 4절). say 에 0~9 가 남으면 목소리를 만들기 전에 고친다.
   - 금지: 기사 문장 베끼기, 15단어 넘는 인용, 루머 단정, 비하, 경품, 참고 계정 문장 베끼기.
5. 그림(gpt_image_2_5, quality medium, aspect_ratio 9:16): 장면마다 1장. 자체 엠블럼 마스코트를 image_references 로 넣는다(media id 아래 표).
   프롬프트 공통: "Bold 2D cartoon illustration in the exact style of the reference mascots ... plain white baseball jerseys with no logos or letters ... characters in the middle third, space at top for text. No text, no logos, no letters, no numbers."
   과거 회상 장면은 "faded sepia flashback tone with film grain". 실제 선수는 그리지 않는다(마스코트만). 참고 형식이 '장면이 자주 바뀌는' 것이면 장면을 나눠 그림 수를 늘려도 된다(한 개 릴스 그림 8장 이하).
   영상 모델(kling·seedance 등)은 부르지 않는다(2026-10-24 주인 결정: 크레딧 절약).
6. 목소리(elevenlabs_v4, dialogue=[{text, voice_type:'preset', voice_id:'e6f9b893-51b1-51d3-afe9-9e0482cb7ac1'}], prompt 는 아무 설명): 장면마다 따로 1개(장면 길이가 목소리 길이로 정해진다). 끝 장면 말은 넣지 않아도 된다.
7. 결과 주소를 curl 로 media/insta/<폴더>/ 에 받는다: 1.png …, a1.mp3 …. 파일이 비었거나 받기 실패면 1회 다시 받고, 그래도 안 되면 만들지 않고 끝낸다.
   reel.json: {"music":"bgm-breaking"(큰 경기·속보) 또는 "bgm-morning", "segments":[{"src","say","text"(그 목소리의 대본 그대로, 숫자는 한글),"kick","head","note"(출처 한 줄, 선택)}], "end"(선택):{"kick","head"(질문),"cta":"나머지 소식은 빠따닷컴에서"}}
   post.json: {"reel_caption": ig-caption 절차로 — 첫 줄(피드에 보이는 약 125자 안)에 이야기의 핵심 + 빈 줄 + 사실 2~3줄 + 질문 1줄 + "👉 프로필 링크 bbadda.com" + 빈 줄 + "출처: 언론 보도 · 그림은 빠따닷컴 자체 캐릭터 · KBO·구단과 관계없는 비공식 팬 사이트예요." + 해시태그 5~8개(#빠따닷컴 포함). 캡션도 humanize.py 로 점검}
   media/insta/reel-queue.json 의 D 항목: 없으면 "D": "<폴더>", 이미 있으면 배열로 바꿔 더한다(["D-reel","D-night"]). 다른 항목은 그대로.
   media/insta/reel-log.md 맨 아래에 한 줄: "| D | 낮/밤 | 형식 이름(참고 @계정) | 첫 문장 |".
   주 1회(월요일 낮)는 ig-audit 절차로 지난주 우리 릴스를 돌아보고 reel-log.md 에 3줄 이내로 적는다(게시물 지표를 볼 수 없으면 "지표 없음"이라 적는다).
8. 브랜치 daily/D-reel 또는 daily/D-night → PR(제목 "인스타 릴스: <주제> (D 낮/밤)", 본문에 참고 형식·후킹 후보·사실·출처·쓴 크레딧) → 검사 통과하면 머지(merge commit).
   이 루틴이 고치는 파일은 media/insta/**, docs/insta-swipe.md 뿐이다. 코드·설정 파일은 고치지 않는다.
   머지되면 ig-reel 이 영상을 조립해 게시한다(몇 분). 직접 게시하지 않는다.
   어느 단계에서 막혀도 그날 릴스는 빠지지 않는다: 대본에 숫자가 남은 장면은 목소리만 꺼지고, 오늘 릴스가 하나도 없으면 ig-reel 이 15:00 KST 에 오늘 카드 세트로 대체 릴스를 올린다(scripts/insta/reel-run.sh). 그래도 막히면 요약에 이유를 적는다.
9. 끝나면 한 단락 요약: 낮/밤, 주제, 참고 형식, PR 링크, 쓴 크레딧, 남은 크레딧.
```

## 마스코트 media id (Higgsfield, 2026-10-24 올림 — public/mascots/emblem/*@2x.webp)

| 팀 | media id |
|---|---|
| kia | 51f4c029-6a50-480b-bf2f-e5e670e2d35a |
| samsung | de7c058d-208c-496e-9278-ff2b577b44c3 |
| doosan | dea506cc-086e-406f-8ae8-608bbac63396 |
| hanwha | 0df8102c-c9a5-46d7-8adb-15ca94067821 |
| kiwoom | 41415d02-14ee-4a61-a0eb-7c5a967b6499 |
| kt | fc2088ee-9fab-4f20-92c2-032af6ff75e7 |
| lg | 057b7409-5035-4ff2-bf93-3eb2673dae48 |
| lotte | e58af41c-554c-4288-a3e8-869a7afd6c41 |
| nc | 3d47d6c1-1366-4c60-90ba-7b51e8944e1d |
| ssg | 840d02f5-2f45-4a69-a0ed-77883a34cef8 |

## 비용(1개 기준)
그림 4장 약 2 + 목소리 4개 약 2.4 = 약 4.4 크레딧. 하루 2개면 한 달 약 260(밤을 건너뛰는 날은 줄어든다). 영상(kling 5초 7.5)은 2026-10-24부터 쓰지 않는다. 다시 쓰려면 주인 결정 후 5단계를 고친다.
seedance_2_5 는 plus 요금제 이상만 쓸 수 있다(2026-10-24 확인).

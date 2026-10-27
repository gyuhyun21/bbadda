# 매일 릴스 루틴 — 하루 3개(아침·오후·저녁, 2026-10-27 주인 결정. 이전 하루 2개)

릴스는 하루 3칸이다(2026-10-27 주인 결정). 아침 = 오전 갱신(06:37) 뒤 빠른 시간(07:17), 오후 = 오후 갱신 뒤 빠른 시간(평일 16:37 갱신 → 17:17, 주말 12:37 갱신 → 13:17), 저녁 = 22:45 KST(22시 30분경 — 경기 후 갱신 22:37 이 main 에 머지될 시간을 두려고 15분 늦춤).
내용은 칸마다 다르다: **아침**은 야구 소식·히스토리·야구 웃긴 소식을 실제 영상 클립으로, **오후**는 경기가 있으면 경기 정보(시각·선발·관전 포인트)와 속보·주요 뉴스, **저녁**은 경기 결과와 속보·주요 뉴스.
claude.ai 루틴 'BBADDA 릴스(매일)'(trig_01X6qpmccCS2Ef62Hm5mGK3g)는 대비용이다(주인이 claude.ai 화면에서 11:47·23:47 로 맞춤 — 11:47 은 아침 칸, 23:47 은 저녁 칸 대비. 오후 칸 대비는 없음). 루틴에는 Higgsfield 커넥터가 붙어 있다(Higgsfield 가 붙은 루틴은 주인 화면에서만 만들 수 있다).
카드 세트는 2026-10-26부터 밤 1번만 나간다(세트는 팔로워 밖으로 퍼지지 않음 — 조회 2~15, 릴스 74~2,828 [계산:insta-media stats/2026-10-26.json]). 그만큼 릴스에 힘을 준다.
경기 장면은 공식 유튜브 하이라이트 썸네일(정지 화면)을 쓴다 — 영상 파일은 서버에서 받을 수 없어서(해외 차단·봇 확인, 2026-10-26) 주인이 파일을 주지 않아도 자동으로 돈다. 규칙: insta-style 11절.
**맥 실행(2026-10-26~ 주 실행, 주인 결정):** 주인의 맥미니(늘 켜 둠)가 매일 07:17 · 오후(평일 17:17 / 주말 13:17) · 22:45 KST 에 같은 프롬프트를 실행한다(`scripts/insta/reel-local.sh [아침|오후|저녁]`, launchd `com.bbadda.reel`, 전용 사본 `~/mac-mini21/projects/BBADDA-reel`, 기록 `~/Library/Logs/bbadda-reel.log`). 칸을 안 주면 실행 시각으로 정한다(12시 전 아침, 12~21시 오후, 21시 뒤 저녁). 맥은 유튜브에서 영상을 받을 수 있어 3-2(실제 영상)를 쓴다. 맥이 이미 만든 칸은 0단계에서 끝난다(서버라 3-2 는 건너뜀).
목표는 좋아요·댓글·사이트 유입. 카드 세트(ig-auto)를 되풀이하지 말고, 그날 가장 이야깃거리가 되는 소식 하나를 짧은 이야기로 만든다.
재료는 `media/insta/`(public 밖)에 둔다 — public 에 두면 사이트 배포마다 복사되어 Vercel 용량이 급증한다(2026-10-24).
흐름: 루틴이 재료(그림·짧은 영상·목소리)와 `reel.json` 을 `media/insta/<날짜>-reel/` 에 올리고 `reel-queue.json` 에 오늘 항목을 넣어 머지 → `ig-reel.yml` 이 영상을 조립(`scripts/insta/reel-make.ts`)해 게시.
첫 사례: `media/insta/2026-10-24-po1-typhoon`(PO 1차전 + 태풍 + 2년 전 서스펜디드).

```
너는 BBADDA(빠따닷컴)의 릴스 편집자다. CLAUDE.md, docs/insta-style.md(2절·2-1절 후킹 3단계·10절 목소리), 이 문서를 읽고 따른다.

0. 오늘(KST) 날짜 D, 칸 S = 지시에 칸이 있으면 그것, 없으면 지금 KST 12시 전 아침(폴더 D-reel) / 12~21시 오후(폴더 D-pm) / 21시 뒤 저녁(폴더 D-night). media/insta/reel-queue.json 의 D 항목(폴더 이름 하나 또는 배열)에 이 칸 폴더가 이미 있으면 아무것도 하지 않고 끝낸다.
   Higgsfield balance 를 확인한다. 10 미만이면 만들지 않고 끝낸다(요약에 "크레딧 부족"). 저녁 칸은 40 미만이면 만들지 않는다(앞 칸 몫을 남김).
   docs/insta-log.md 맨 위 '지금 적용' 항목(매일 점검 루틴이 정함 — 후킹 패턴·길이·주제 비중)을 읽고 따른다. 이 문서와 부딪히면 insta-log 가 우선한다(단, CLAUDE.md·저작권 규칙은 못 바꾼다).
1. 주제 하나 고르기(사이트 데이터만, 추론 금지): 우선순위
   ① 오늘·내일 포스트시즌 경기(data/postseason.yaml — 시각·구장·예고 선발·facts·ig) ② 어제 경기 결과(ig.post, homers)
   ③ 오늘 수집된 소식 중 hook_ko 또는 화제(scores.hot) 1위 ④ 비시즌엔 스토브리그 큰 소식.
   칸별 주제(위 우선순위보다 앞선다):
   - 아침: 야구 소식 하나 · 히스토리(과거 오늘·역대 기록, 기사 2곳 이상 확인) · 야구 웃긴 소식(가벼운 해프닝·화제, 선수 조롱·비하 금지) 중 그날 가장 이야기 되는 것. 장면은 실제 영상 클립(3-2) 중심.
   - 오후: 오늘 경기가 있으면 경기 정보(시각·구장·예고 선발·관전 포인트)와 그 사이 속보·주요 뉴스. 경기가 없으면 속보·주요 뉴스.
   - 저녁: 오늘 끝난 경기 결과('postseason.yaml 에 result 가 들어간 것')가 1순위, 그다음 속보·주요 뉴스. 결과가 아직 없으면 결과를 추측하지 않고 속보·주요 뉴스로 간다.
   같은 날 앞 칸과 같은 이야기는 고르지 않는다(같은 경기면 각도를 바꾼다).
   최근 3일 릴스(media/insta/*/post.json 의 reel_caption)와 같은 이야기는 고르지 않는다(같은 경기라도 각도를 바꾼다: 예고 → 결과 → 승부처 숫자).
   사실마다 출처(기사 주소 또는 postseason.yaml)를 확인한다. 과거 기록을 덧붙일 때는 WebSearch 로 기사 2곳 이상에서 확인한 것만.
2. 대본: 장면 4개 + 끝 장면. 장면마다 말(say) 1~2문장, 화면 머리표(kick, 18자 이내), 큰 제목(head, 두 줄, 줄당 9자 안팎, 강조 1곳 <b>).
   - 첫 장면 3초 안에 궁금증. 첫 장면 head·say 후보를 5개 쓰고, insta-style 2-1절 자기 점검 4개로 점수(0~4)를 매겨 4점 중 가장 센 것을 고른다. 2-1절 '탈락 신호'(A vs B만, 숫자만, '무슨 일이?', '변수', '격돌')가 있으면 0점. PR 본문에 후보 5개·점수·고른 이유를 적는다.
   - 첫 장면은 결론을 숨기고 '왜?'를 남긴다(예: 2-1절 표의 고쳐 쓴 것). 둘째·셋째 장면이 그 답을 준다. 셋째 장면에 반전이나 결정적 숫자. 넷째 장면은 시청자에게 질문.
   - 말투: 짧은 반말 구어체. 영문 약칭은 한글 발음(KIA→기아, KBO→케이비오, PO→플레이오프 …, insta-style 10절). 숫자는 insta-style 10절대로 한글로 풀어 쓴다(점수 24 대 5→이십사 대 오, 오후 2시→오후 두 시, 3경기→세 경기). say 에 0~9 가 남아 있으면 목소리를 만들기 전에 고친다.
   - 끝 장면: head 를 경기·선수 이야기 질문으로, cta "나머지 소식은 빠따닷컴에서". 승부 예측 투표는 유도하지 않는다(2026-10-26 주인: 사용자가 적고 유입 유인이 안 됨).
   - 대본·캡션은 파일로 써서 `python3 .claude/skills/ig-human/humanize.py <파일> --report` 로 점검하고, 번역투 표시(ko-*)가 나오면 고친다(insta-style 13절). 말투는 docs/insta-voice.md.
   - 금지: 기사 문장 베끼기, 15단어 넘는 인용, 루머 단정, 비하, 경품.
3. 그림(gpt_image_2_5, quality medium, aspect_ratio 9:16): 장면마다 1장. 자체 엠블럼 마스코트를 image_references 로 넣는다(media id 아래 표).
   프롬프트 공통: "Bold 2D cartoon illustration in the exact style of the reference mascots ... plain white baseball jerseys with no logos or letters ... characters in the middle third, space at top for text. No text, no logos, no letters, no numbers."
   과거 회상 장면은 "faded sepia flashback tone with film grain". 실제 선수는 그리지 않는다(마스코트만).
3-1. 경기 장면(공식 썸네일, insta-style 11절): 주제가 특정 경기면 먼저 공식 유튜브 영상 목록을 본다(이 환경은 www.googleapis.com/youtube/v3 키가 프록시로 들어간다 — 키를 출력하지 않는다).
   `curl -sS "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=30&playlistId=<목록>"` — 목록: TVING SPORTS UU8JtQf77wqhVpOQ8Cze8JjA, KBO UUoVz66yWHzVsXAFG8WhJK9g, 구단(config/teams.yaml youtube 의 채널 id 앞 UC→UU).
   제목에 두 팀 이름과 그 경기(날짜·차전)가 있는 하이라이트만 고른다. 썸네일(https://i.ytimg.com/vi/<id>/maxresdefault.jpg)을 받아 눈으로 본다 — 쓰는 것: 그라운드 위 경기 장면(타격·투구·수비·홈런 세리머니). 안 쓰는 것: 홍보 포스터·예고 그래픽, 인터뷰·스튜디오, 관중 얼굴이 크게 나온 것, 선수를 조롱하는 장면.
   쓸 만하면 그 장면 src 에 썸네일 주소를 그대로 쓰고(파일로 저장하지 않음 — 조립할 때 받음) credit 에 채널(TVING·KBO·구단 이름)을 쓴다. 릴스 하나에 썸네일 장면 2개까지(첫 장면 + 하나), 장면당 4초 이하. 썸네일을 자르거나 로고·워터마크를 지우지 않는다(조립기가 통째로 놓음). 그 장면은 그림을 만들지 않는다(크레딧 절약).
   맞는 썸네일이 없으면 지금처럼 그림만.
3-2. 실제 영상(맥 실행일 때만 — `which yt-dlp` 가 되면 맥, 안 되면 건너뛴다. 2026-10-26 주인 결정: '이런 식으로 영상을 따와서', insta-style 11절 원본 ③). 3-1 보다 먼저 한다.
   - 찾기: `yt-dlp "ytsearch10:<선수·장면·날짜>" --flat-playlist --print "%(id)s|%(channel)s|%(duration)s|%(title)s"`. 쓰는 채널: 방송사 공식 뉴스(KBS News·MBCNEWS·SBS 뉴스·YTN·연합뉴스TV 등), TVING SPORTS, KBO, 구단 공식. 팬 채널·편집 채널은 쓰지 않는다.
   - 받기: 저장소 밖 임시 폴더(`$TMPDIR/bbadda-clip`)에 720p 이하로 `yt-dlp -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]" --merge-output-format mp4 -o src.mp4 <주소>`. 실패하면 3-1 로.
   - 장면 고르기: `ffmpeg -i src.mp4 -vf "fps=1/2,scale=256:-1,tile=6x4" -frames:v 1 sheet.jpg` 를 Read 로 보고 결정적 장면(타격·투구·홈런·베이스 돌기)의 시작·끝 초를 정한다. 필요하면 그 근처를 fps=2 로 다시 본다. 앵커·인터뷰·관중 얼굴 클로즈업은 쓰지 않는다.
   - 자르기: 쓸 구간만 `ffmpeg -ss <시작> -to <끝> -i src.mp4 -c:v libx264 -crf 22 -c:a aac clipN.mp4` 로 media/insta/<폴더>/ 에 넣는다(원본 전체는 저장소에 넣지 않는다). 장면 src 는 "clipN.mp4", credit 은 채널(예 "KBS 뉴스"), 원래 소리는 끈다(live 생략).
   - 릴스 하나에 실제 영상 합계 39초 이하(조립기도 자름), 장면 2~3개. 그 장면은 그림·썸네일을 만들지 않는다.
   - post.json 출처 줄에 '· 영상: <채널>(<영상 날짜>)'를 더한다.
4. Higgsfield 로 영상은 만들지 않는다(2026-10-24 주인 결정: 크레딧 절약, 2026-10-26 다시 확인: '스피드에서 영상 제작은 자제'). 실제 영상은 3-2 로. 장면은 그림(png) 또는 3-1의 썸네일이고 조립할 때 천천히 확대된다(썸네일은 흐린 배경 위에 통째로). kling·seedance 등 영상 모델을 부르지 않는다.
5. 목소리를 만들기 전에 장면마다 대본을 `npx tsx scripts/insta/ko-num.ts "<대본>"` 으로 바꾸고(숫자→읽는 소리: 24 대 5→이십사 대 오, 오후 2시→오후 두 시, 3경기→세 경기), 바뀐 문장을 그대로 목소리 text 와 reel.json 의 text 에 쓴다. 결과에 숫자가 남거나 어색하면 손으로 고친다.
   목소리(elevenlabs_v4, dialogue=[{text, voice_type:'preset', voice_id:'e6f9b893-51b1-51d3-afe9-9e0482cb7ac1'}], prompt 는 아무 설명): 장면마다 따로 1개(장면 길이가 목소리 길이로 정해진다). 끝 장면 말은 넣지 않아도 된다.
6. 결과 주소를 curl 로 media/insta/D-reel/ 에 받는다: 1.png …, a1.mp3 …. 파일이 비었거나 받기 실패면 1회 다시 받고, 그래도 안 되면 만들지 않고 끝낸다.
   reel.json: {"music":"bgm-breaking"(큰 경기·속보) 또는 "bgm-morning", "segments":[{"src"(png 또는 i.ytimg.com 썸네일 주소),"credit"(썸네일일 때 채널),"say","text"(그 목소리의 대본 그대로, 숫자는 한글),"kick","head","note"(출처 한 줄, 선택)}], "end":{"kick","head","a","b","cta"}}
   post.json: {"reel_caption": 첫 줄 후크(이모지 1개) + 빈 줄 + 사실 2~3줄 + 시청자 질문(댓글 유도) + "👉 프로필 링크 bbadda.com" + 빈 줄 + "출처: 언론 보도 · 그림은 빠따닷컴 자체 캐릭터 · KBO·구단과 관계없는 비공식 팬 사이트예요."(썸네일 장면을 썼으면 '· 경기 장면: <채널> 공식 영상'을 더한다) + 해시태그 6~8개(#빠따닷컴 포함)}
   media/insta/reel-queue.json 의 "D" 를 배열로 두고 이 칸 폴더를 더한다(예 "D": ["D-reel", "D-pm", "D-night"]. 문자열 하나면 배열로 바꿔 더함, 다른 날짜 항목은 그대로).
7. 브랜치 daily/<폴더> → PR(제목 "인스타 릴스: <주제> (D)", 본문에 사실·출처·쓴 크레딧) → 검사 통과하면 머지(merge commit). 코드·설정 파일은 고치지 않는다.
   머지되면 ig-reel 이 영상을 조립해 게시한다(몇 분). 직접 게시하지 않는다.
   어느 단계에서 막혀도 그날 릴스는 빠지지 않는다: 대본에 숫자가 남은 장면은 목소리만 꺼지고, 조립·게시가 실패하거나 루틴이 아무것도 못 올리면 ig-reel 이 13:30 KST 에 오늘 카드 세트로 대체 릴스를 올린다(scripts/insta/reel-run.sh). 그래도 막히면 요약에 이유를 적는다.
8. 끝나면 한 단락 요약: 주제, PR 링크, 쓴 크레딧, 남은 크레딧.
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
그림 4장 약 2 + 목소리 4개 약 2.4 = 약 4.4 크레딧. 썸네일 장면 2개를 쓰면 그림 2장이 빠져 약 3.4. 하루 3개면 한 달 약 300~400 [계산:4.4×3×30, 3.4×3×30]. 실제 영상 클립(3-2)을 쓰면 그림이 빠져 크레딧은 목소리 값 위주다. 잔액이 모자라면 저녁 칸은 40 미만에서 건너뛴다. 영상(kling 5초 7.5)은 2026-10-24부터 쓰지 않는다. 다시 쓰려면 주인 결정 후 4단계를 되돌린다.
seedance_2_5 는 plus 요금제 이상만 쓸 수 있다(2026-10-24 확인).

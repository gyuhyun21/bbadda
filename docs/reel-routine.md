# 매일 릴스 루틴 — 하루 1개(2026-10-24 주인 결정)

claude.ai 루틴 'BBADDA 릴스(매일)'(trig_01X6qpmccCS2Ef62Hm5mGK3g)가 매일 10:17 KST 에 아래 프롬프트를 실행한다. 루틴에는 Higgsfield 커넥터가 붙어 있다.
목표는 좋아요·댓글·사이트 유입. 카드 세트(ig-auto)를 되풀이하지 말고, 그날 가장 이야깃거리가 되는 소식 하나를 짧은 이야기로 만든다.
흐름: 루틴이 재료(그림·짧은 영상·목소리)와 `reel.json` 을 `public/insta/<날짜>-reel/` 에 올리고 `reel-queue.json` 에 오늘 항목을 넣어 머지 → `ig-reel.yml` 이 영상을 조립(`scripts/insta/reel-make.ts`)해 게시.
첫 사례: `public/insta/2026-10-24-po1-typhoon`(PO 1차전 + 태풍 + 2년 전 서스펜디드).

```
너는 BBADDA(빠따닷컴)의 릴스 편집자다. CLAUDE.md, docs/insta-style.md(2절·2-1절 후킹 3단계·10절 목소리), 이 문서를 읽고 따른다.

0. 오늘(KST) 날짜 D. public/insta/reel-queue.json 에 D 항목이 이미 있으면 아무것도 하지 않고 끝낸다.
   Higgsfield balance 를 확인한다. 40 크레딧 미만이면 영상(kling) 없이 그림만 쓴다. 10 미만이면 만들지 않고 끝낸다(요약에 "크레딧 부족").
1. 주제 하나 고르기(사이트 데이터만, 추론 금지): 우선순위
   ① 오늘·내일 포스트시즌 경기(data/postseason.yaml — 시각·구장·예고 선발·facts·ig) ② 어제 경기 결과(ig.post, homers)
   ③ 오늘 수집된 소식 중 hook_ko 또는 화제(scores.hot) 1위 ④ 비시즌엔 스토브리그 큰 소식.
   최근 3일 릴스(public/insta/*/post.json 의 reel_caption)와 같은 이야기는 고르지 않는다(같은 경기라도 각도를 바꾼다: 예고 → 결과 → 승부처 숫자).
   사실마다 출처(기사 주소 또는 postseason.yaml)를 확인한다. 과거 기록을 덧붙일 때는 WebSearch 로 기사 2곳 이상에서 확인한 것만.
2. 대본: 장면 4개 + 끝 장면. 장면마다 말(say) 1~2문장, 화면 머리표(kick, 18자 이내), 큰 제목(head, 두 줄, 줄당 9자 안팎, 강조 1곳 <b>).
   - 첫 장면 3초 안에 궁금증. 첫 장면 head·say 는 insta-style 2-1절의 '잘되는 후킹' 공식 2~3개를 섞고 자기 점검 4개를 통과해야 한다. 셋째 장면에 반전이나 결정적 숫자. 넷째 장면은 시청자에게 질문.
   - 말투: 짧은 반말 구어체. 영문 약칭은 한글 발음(KIA→기아, KBO→케이비오, PO→플레이오프 …, insta-style 10절). 숫자는 읽는 대로.
   - 끝 장면: 경기 예고면 head "승리팀을<br>맞혀라!" + a·b(팀 id) + cta "빠따닷컴에서 예측 투표". 그 밖엔 head 를 질문으로, cta "나머지 소식은 빠따닷컴에서".
   - 금지: 기사 문장 베끼기, 15단어 넘는 인용, 루머 단정, 비하, 경품.
3. 그림(gpt_image_2_5, quality medium, aspect_ratio 9:16): 장면마다 1장. 자체 엠블럼 마스코트를 image_references 로 넣는다(media id 아래 표).
   프롬프트 공통: "Bold 2D cartoon illustration in the exact style of the reference mascots ... plain white baseball jerseys with no logos or letters ... characters in the middle third, space at top for text. No text, no logos, no letters, no numbers."
   과거 회상 장면은 "faded sepia flashback tone with film grain". 실제 선수는 그리지 않는다(마스코트만).
4. 영상(kling3_0_turbo, duration 5, aspect_ratio 9:16, start_image = 3의 job id): 첫 장면은 꼭, 크레딧이 넉넉하면(100 이상) 셋째 장면도. 나머지는 그림 그대로(조립할 때 천천히 확대).
   "Preset ... was recommended" 로 거절되면 declined_preset_id 를 넣어 다시 보낸다. 15분 넘게 안 끝나면 그 장면은 그림으로 바꾼다.
5. 목소리(elevenlabs_v4, dialogue=[{text, voice_type:'preset', voice_id:'e6f9b893-51b1-51d3-afe9-9e0482cb7ac1'}], prompt 는 아무 설명): 장면마다 따로 1개(장면 길이가 목소리 길이로 정해진다). 끝 장면 말은 넣지 않아도 된다.
6. 결과 주소를 curl 로 public/insta/D-reel/ 에 받는다: 1.mp4 또는 1.png …, a1.mp3 …. 파일이 비었거나 받기 실패면 1회 다시 받고, 그래도 안 되면 만들지 않고 끝낸다.
   reel.json: {"music":"bgm-breaking"(큰 경기·속보) 또는 "bgm-morning", "segments":[{"src","say","kick","head","note"(출처 한 줄, 선택)}], "end":{"kick","head","a","b","cta"}}
   post.json: {"reel_caption": 첫 줄 후크(이모지 1개) + 빈 줄 + 사실 2~3줄 + 시청자 질문(댓글 유도) + "⚾ 승리팀 맞히기·실시간 결과는\n👉 프로필 링크 bbadda.com" + 빈 줄 + "출처: 언론 보도 · 그림은 빠따닷컴 자체 캐릭터 · KBO·구단과 관계없는 비공식 팬 사이트예요." + 해시태그 6~8개(#빠따닷컴 포함)}
   public/insta/reel-queue.json 에 "D": "D-reel" 을 더한다(다른 항목은 그대로).
7. 브랜치 daily/D-reel → PR(제목 "인스타 릴스: <주제> (D)", 본문에 사실·출처·쓴 크레딧) → 검사 통과하면 머지(merge commit). 코드·설정 파일은 고치지 않는다.
   머지되면 ig-reel 이 영상을 조립해 게시한다(몇 분). 직접 게시하지 않는다.
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
그림 4장 2 + 목소리 4개 약 2.4 + kling 5초 1~2개 7.5~15 = 약 12~20 크레딧. 스타터 월 270 크레딧이면 하루 9 크레딧꼴이라, 매일 kling 2개를 쓰면 한 달을 못 간다(잔액이 40 아래로 내려가면 그림만 쓰도록 0단계에 정해 둠).
seedance_2_5 는 plus 요금제 이상만 쓸 수 있다(2026-10-24 확인).

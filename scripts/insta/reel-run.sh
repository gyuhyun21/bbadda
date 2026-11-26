#!/usr/bin/env bash
# 릴스 게시 실행(ig-reel.yml 이 부름): reel-run.sh <폴더 이름|빈칸> <fallback: true|false>
# 1) media/insta/<폴더>(입력 또는 media/insta/reel-queue.json 의 오늘 항목)를 게시. reel.mp4 가 있으면 그대로, 없고 reel.json 만 있으면 조립해서 insta-media 에 올리고 jsDelivr 주소로 게시
#    (재료는 사이트 배포에 실리지 않게 public 밖 media/ 에 둔다 — 2026-10-24 Vercel 배포 용량 급증)
# 2) 점심 실행(12:30 KST, 3번째 인자 true): 오늘 점심 POOL 이 아직 없으면 media/insta/pool/ 다음 편을 큐에 먼저 기록(main 커밋)하고 게시 — 하루 4번째 칸(2026-11-11 이사님). LUNCH_PAUSE_UNTIL 날짜까지는 쉼
# 3) 그게 실패했거나, fallback 실행(13:30 KST)인데 오늘 릴스가 아직 없으면: 가장 최근 자동 카드 세트(어제 밤 또는 오늘, insta-media)로 릴스를 만들어 게시 — 그날 릴스를 빠뜨리지 않는다(2026-10-24 주인)
# 환경변수 TOKEN(출력 안 함), IG, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY, LUNCH_PAUSE_UNTIL(빈칸이면 점심 칸 평소대로)
set -euo pipefail
POST="${1:-}"; FALLBACK="${2:-false}"; LUNCH="${3:-false}"
D=$(TZ=Asia/Seoul date +%F)
G="https://graph.facebook.com/v21.0"; AUTH="Authorization: Bearer $TOKEN"
say() { echo "$*" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
prep() {
  [ -n "${PREPPED:-}" ] && return; PREPPED=1
  for t in 1 2 3; do timeout 300 sudo apt-get -qq update >/dev/null && timeout 300 sudo apt-get -qq install -y ffmpeg fonts-noto-cjk fonts-noto-color-emoji >/dev/null && break; echo "apt 재시도 $t"; sleep 10; done
  timeout 600 npm ci --silent
  git config user.name "github-actions[bot]"; git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
}
# 조립한 영상을 insta-media/reel/<이름>/reel.mp4 에 올리고 공개 주소를 출력
upload() {
  # jsDelivr 는 GitHub 파일 20MB 까지만 내준다 — 넘으면 화질을 낮춰 다시 묶는다
  if [ "$(stat -c %s "$1")" -gt 18000000 ]; then ffmpeg -y -loglevel error -i "$1" -c:v libx264 -crf 28 -preset slow -c:a copy -movflags +faststart /tmp/small.mp4 && cp /tmp/small.mp4 "$1"; fi
  git fetch -q origin insta-media
  rm -rf /tmp/media; git worktree prune
  git worktree add -q /tmp/media origin/insta-media
  # 같은 편을 다시 돌리면 같은 영상이라 커밋할 게 없다 — 그때는 커밋·푸시 없이 주소만 낸다. git 출력은 stderr 로(주소에 섞여 curl: URL rejected, 2026-11-26 저녁 편)
  ( cd /tmp/media && git checkout -q -B insta-media && mkdir -p "reel/$2" && cp "$1" "reel/$2/reel.mp4" && git add reel \
    && { git diff --cached --quiet || { git commit -qm "reel: $2" && git push -q origin insta-media; }; } ) >&2 || return 1
  echo "https://cdn.jsdelivr.net/gh/${GITHUB_REPOSITORY}@insta-media/reel/$2/reel.mp4"
}
# 게시물 목록 — 일시 오류는 다시 시도. 끝내 실패하면 2 를 돌려 「안 올라감」과 구분한다(확인 실패를 안 올라감으로 봐서 pool/21 이 두 번 올라감, 2026-11-20)
ig_media() { curl -sS -f --retry 3 --retry-all-errors --retry-delay 5 -H "$AUTH" "$G/$IG/media?fields=$1" || { say "경고: 인스타 게시물 확인 실패 — 이번엔 게시 안 함" >&2; return 2; }; }
# 같은 본문이 최근 게시물에 있으면 0(이미 게시), 없으면 1, 그 밖=확인 실패
posted_caption() { local j; j=$(ig_media "caption&limit=15") || return 2; jq -e --rawfile c "$1" 'any(.data[]; (.caption // "") == ($c | rtrimstr("\n")))' <<<"$j" >/dev/null; }
# 오늘(KST) 올라간 릴스가 있으면 0
reel_today() { local j; j=$(ig_media "media_product_type,timestamp&limit=10") || return 2; jq -e --arg d "$D" 'any(.data[]; .media_product_type == "REELS" and ((.timestamp | sub("\\+0000$"; "Z") | fromdateiso8601) + 32400 | strftime("%Y-%m-%d")) == $d)' <<<"$j" >/dev/null; }

main_post() {
  # save pool 릴스(media/insta/pool/<편>, 2026-11-11 이사님 승인)는 큐에 "pool/<편>" 으로 넣는다 — 하위 폴더는 pool/ 하나만 허용
  [[ "$POST" =~ ^(pool/)?[0-9a-z-]+$ ]] || { say "잘못된 폴더 이름: $POST"; return 1; }
  local dir="media/insta/$POST"
  jq -r '.reel_caption // .caption' "$dir/post.json" > /tmp/cap.txt
  local pc=0; posted_caption /tmp/cap.txt || pc=$?
  [ "$pc" = 0 ] && { say "이미 게시됨, 건너뜀: $POST"; return 0; }
  [ "$pc" = 1 ] || return 1  # 확인 실패 — 큐에 남아 있으니 다음 실행이 다시 확인하고 올린다
  local url spec=""
  if [ -f "$dir/reel.mp4" ]; then
    prep
    cp "$dir/reel.mp4" /tmp/reel.mp4
    url=$(upload /tmp/reel.mp4 "$POST") || return 1
  elif [ -f "$dir/reel.json" ]; then
    prep
    # if 안에서는 set -e 가 꺼지므로 단계마다 실패를 직접 돌려준다
    npx tsx scripts/insta/reel-make.ts "$dir" /tmp/reel.mp4 > /tmp/make.log 2>&1 || { cat /tmp/make.log; return 1; }
    grep '경고' /tmp/make.log | while read -r l; do say "$l"; done || true  # 경고가 없으면 grep 이 1 — 점심 칸은 main_post 를 || 없이 불러 set -e 로 조용히 죽었다(2026-11-11)
    url=$(upload /tmp/reel.mp4 "$POST") || return 1
    spec="$dir/reel.json"  # igAudio(인스타 음원)는 조립한 릴스에만 — reel.mp4 는 bgm 이 이미 들어 있다
  else say "영상도 재료도 없음: $dir"; return 1
  fi
  local res; res=$(bash scripts/insta/reel.sh "$url" /tmp/cap.txt "$spec" 2>/tmp/reel-err.log) || { cat /tmp/reel-err.log; echo "$res"; return 1; }
  grep '음원\|경고' /tmp/reel-err.log | while read -r l; do say "$l"; done || true
  say "게시: $res"
}

cards_post() {
  local rt=0; reel_today || rt=$?
  [ "$rt" = 0 ] && { say "오늘 릴스 이미 있음 — 대체 릴스 안 만듦"; return 0; }
  [ "$rt" = 1 ] || return 1
  git fetch -q origin insta-media
  # 카드 세트는 밤에만 만든다(2026-10-26~) — 낮 대체 릴스는 어제 밤 세트로
  local Y; Y=$(TZ=Asia/Seoul date -d yesterday +%F)
  local key; key=$(git ls-tree --name-only origin/insta-media | grep -E "^($Y|$D)-" | sort | while read k; do git cat-file -e "origin/insta-media:$k/1.jpg" 2>/dev/null && git cat-file -e "origin/insta-media:$k/post.json" 2>/dev/null && echo "$k"; done | tail -1 || true)  # 카드 세트가 없으면 grep 이 1 — 아래 안내가 찍히게
  [ -n "$key" ] || { say "대체 릴스 실패: 어제·오늘 카드 세트도 없음"; return 1; }
  prep
  local dir=/tmp/cards; rm -rf "$dir"; mkdir -p "$dir"
  local n=0; for i in 1 2 3 4 5 6; do git show "origin/insta-media:$key/$i.jpg" > "$dir/$i.jpg" 2>/dev/null && n=$i || { rm -f "$dir/$i.jpg"; break; }; done
  jq -n --argjson n "$n" '{music:"bgm-morning", segments:[range(1; $n + 1) | {src:"\(.).jpg", fit:true, dur:(if . == 1 then 3.5 else 3 end)}]}' > "$dir/reel.json"
  git show "origin/insta-media:$key/post.json" | jq -r '.caption' | sed '1s/^/🎬 요약 | /' > /tmp/cap.txt
  npx tsx scripts/insta/reel-make.ts "$dir" /tmp/reel.mp4
  say "대체 릴스(카드 $key, ${n}장): $(bash scripts/insta/reel.sh "$(upload /tmp/reel.mp4 "$D-cards")" /tmp/cap.txt)"
}

# 점심 칸: 큐의 "lunch" 칸(날짜 → "pool/<편>")에 오늘 것이 있으면 그 편(이미 올렸으면 main_post 가 건너뜀), 없으면 어제 점심 편이 게시 안 됐을 때 그 편, 아니면 큐 어디에도 없는 가장 앞 번호 편.
# 기록을 먼저 main 에 올리고 게시한다 — 오후 칸(맥 0단계)이 같은 편을 고르지 않게. 오늘 배열에도 더해 두면 게시가 실패해도 다음 큐 변경 때 다시 올린다
lunch_post() {
  # 점심 칸 쉼: 저장소 변수 LUNCH_PAUSE_UNTIL(YYYY-MM-DD, KST) 날짜까지는 큐 기록도 게시도 하지 않는다 — 릴스 시험 하루 2편(2026-11-27~12-03, 이재용(CoS)). 변수를 지우거나 날짜가 지나면 저절로 다시 돈다
  local until="${LUNCH_PAUSE_UNTIL:-}"
  if [ -n "$until" ]; then
    [[ "$until" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { say "경고: LUNCH_PAUSE_UNTIL 형식이 날짜(YYYY-MM-DD)가 아님 — 점심 칸 쉼"; return 0; }
    [[ "$D" > "$until" ]] || { say "점심 칸 쉼(~$until)"; return 0; }
  fi
  prep
  local Q=media/insta/reel-queue.json p=""
  for t in 1 2 3; do
    git fetch -q origin main; git checkout -q -f -B main origin/main
    p=$(jq -r --arg d "$D" '.lunch[$d] // empty' "$Q")
    [ -n "$p" ] && { say "점심 POOL 이미 기록됨: $p"; break; }
    # 어제 점심 편이 기록만 되고 게시되지 않았으면(게시 실패) 오늘 점심에 그 편을 다시 — 최근 15개 게시물로 보므로 어제 것만 본다
    local y; y=$(jq -r --arg d "$(TZ=Asia/Seoul date -d yesterday +%F)" '.lunch[$d] // empty' "$Q")
    if [ -n "$y" ] && [ -f "media/insta/$y/post.json" ]; then
      jq -r '.reel_caption // .caption' "media/insta/$y/post.json" > /tmp/ycap.txt
      local yc=0; posted_caption /tmp/ycap.txt || yc=$?
      [ "$yc" = 1 ] && { p="$y"; say "어제 점심 편 게시 안 됨 — 다시: $y"; }  # 확인 실패(2)면 어제 편은 다시 올리지 않는다
    fi
    [ -n "$p" ] || p=$(for k in $(ls -d media/insta/pool/*/ | xargs -n1 basename | sort); do [ -f "media/insta/pool/$k/post.json" ] && ! grep -qF "\"pool/$k\"" "$Q" && { echo "pool/$k"; break; }; done; true)
    [ -n "$p" ] || { say "POOL 남은 편 없음 — 점심 칸 건너뜀"; return 0; }
    jq --arg d "$D" --arg p "$p" '.[$d] = ((.[$d] // []) | if type == "array" then . else [.] end) + [$p] | .lunch[$d] = $p' "$Q" > /tmp/q.json && mv /tmp/q.json "$Q"
    git commit -qm "reel-queue: $D 점심 $p" "$Q" && git push -q origin HEAD:main && break
    say "큐 기록 push 실패($t) — 다시"; p=""; sleep 5
  done
  [ -n "$p" ] || { say "점심 칸 큐 기록 실패"; return 1; }
  POST="$p"; main_post || return 1  # 다른 칸처럼 || 로 불러 set -e 가 함수 안 줄마다 죽이지 않게
}
if [ "$LUNCH" = true ]; then lunch_post; exit $?; fi

# 오늘 항목은 폴더 이름 하나 또는 배열(하루 3개 — 아침·오후·저녁, 2026-10-27~). 이미 게시한 것은 main_post 가 본문으로 알아보고 건너뛴다
if [ -z "$POST" ]; then POSTS=$(jq -r --arg d "$D" '.[$d] // empty | if type == "array" then .[] else . end' media/insta/reel-queue.json 2>/dev/null || true); else POSTS="$POST"; fi
if [ -n "$POSTS" ]; then
  failed=0
  for POST in $POSTS; do main_post || { say "경고: $POST 게시 실패"; failed=1; }; done
  [ "$failed" = 0 ] && exit 0
  say "→ 카드 세트로 대체 릴스(오늘 릴스가 하나도 없을 때만)"
  cards_post; exit $?
fi
if [ "$FALLBACK" = true ]; then cards_post; exit $?; fi
say "오늘 예약 릴스 없음(13:30 KST 에 없으면 카드 세트로 대체)"

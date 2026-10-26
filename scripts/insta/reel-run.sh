#!/usr/bin/env bash
# 릴스 게시 실행(ig-reel.yml 이 부름): reel-run.sh <폴더 이름|빈칸> <fallback: true|false>
# 1) media/insta/<폴더>(입력 또는 media/insta/reel-queue.json 의 오늘 항목 — 문자열 하나 또는 배열, 하루 2개까지 2026-10-26~)를 차례로 게시. 이미 올라간 것(같은 본문)은 건너뜀. reel.mp4 가 있으면 그대로, 없고 reel.json 만 있으면 조립해서 insta-media 에 올리고 jsDelivr 주소로 게시
#    (재료는 사이트 배포에 실리지 않게 public 밖 media/ 에 둔다 — 2026-10-24 Vercel 배포 용량 급증)
# 2) 그게 실패했거나, fallback 실행(15:00 KST)인데 오늘 릴스가 아직 없으면: 오늘 자동 카드 세트(insta-media)로 릴스를 만들어 게시 — 그날 릴스를 빠뜨리지 않는다(2026-10-24 주인)
# 환경변수 TOKEN(출력 안 함), IG, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY
set -euo pipefail
POST="${1:-}"; FALLBACK="${2:-false}"
D=$(TZ=Asia/Seoul date +%F)
G="https://graph.facebook.com/v21.0"; AUTH="Authorization: Bearer $TOKEN"
say() { echo "$*" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
prep() {
  [ -n "${PREPPED:-}" ] && return; PREPPED=1
  for t in 1 2 3; do timeout 300 sudo apt-get -qq update >/dev/null && timeout 300 sudo apt-get -qq install -y ffmpeg fonts-noto-cjk >/dev/null && break; echo "apt 재시도 $t"; sleep 10; done
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
  ( cd /tmp/media && git checkout -q -B insta-media && mkdir -p "reel/$2" && cp "$1" "reel/$2/reel.mp4" && git add reel && git commit -qm "reel: $2" && git push -q origin insta-media )
  echo "https://cdn.jsdelivr.net/gh/${GITHUB_REPOSITORY}@insta-media/reel/$2/reel.mp4"
}
# 같은 본문이 최근 게시물에 있으면 0(이미 게시)
posted_caption() { curl -sS -f -H "$AUTH" "$G/$IG/media?fields=caption&limit=15" | jq -e --rawfile c "$1" 'any(.data[]; (.caption // "") == ($c | rtrimstr("\n")))' >/dev/null; }
# 오늘(KST) 올라간 릴스가 있으면 0
reel_today() { curl -sS -f -H "$AUTH" "$G/$IG/media?fields=media_product_type,timestamp&limit=10" | jq -e --arg d "$D" 'any(.data[]; .media_product_type == "REELS" and ((.timestamp | sub("\\+0000$"; "Z") | fromdateiso8601) + 32400 | strftime("%Y-%m-%d")) == $d)' >/dev/null; }

main_post() {
  [[ "$POST" =~ ^[0-9a-z-]+$ ]] || { say "잘못된 폴더 이름: $POST"; return 1; }
  local dir="media/insta/$POST"
  jq -r '.reel_caption // .caption' "$dir/post.json" > /tmp/cap.txt
  if posted_caption /tmp/cap.txt; then say "이미 게시됨, 건너뜀: $POST"; return 0; fi
  local url
  if [ -f "$dir/reel.mp4" ]; then
    prep
    cp "$dir/reel.mp4" /tmp/reel.mp4
    url=$(upload /tmp/reel.mp4 "$POST") || return 1
  elif [ -f "$dir/reel.json" ]; then
    prep
    # if 안에서는 set -e 가 꺼지므로 단계마다 실패를 직접 돌려준다
    npx tsx scripts/insta/reel-make.ts "$dir" /tmp/reel.mp4 > /tmp/make.log 2>&1 || { cat /tmp/make.log; return 1; }
    grep '경고' /tmp/make.log | while read -r l; do say "$l"; done
    url=$(upload /tmp/reel.mp4 "$POST") || return 1
  else say "영상도 재료도 없음: $dir"; return 1
  fi
  local res; res=$(bash scripts/insta/reel.sh "$url" /tmp/cap.txt) || { echo "$res"; return 1; }
  say "게시: $res"
}

cards_post() {
  if reel_today; then say "오늘 릴스 이미 있음 — 대체 릴스 안 만듦"; return 0; fi
  git fetch -q origin insta-media
  local key; key=$(git ls-tree --name-only origin/insta-media | grep "^$D-" | while read k; do git cat-file -e "origin/insta-media:$k/1.jpg" 2>/dev/null && git cat-file -e "origin/insta-media:$k/post.json" 2>/dev/null && echo "$k"; done | tail -1)
  [ -n "$key" ] || { say "대체 릴스 실패: 오늘 카드 세트도 없음"; return 1; }
  prep
  local dir=/tmp/cards; rm -rf "$dir"; mkdir -p "$dir"
  local n=0; for i in 1 2 3 4 5 6; do git show "origin/insta-media:$key/$i.jpg" > "$dir/$i.jpg" 2>/dev/null && n=$i || { rm -f "$dir/$i.jpg"; break; }; done
  jq -n --argjson n "$n" '{music:"bgm-morning", segments:[range(1; $n + 1) | {src:"\(.).jpg", fit:true, dur:(if . == 1 then 3.5 else 3 end)}]}' > "$dir/reel.json"
  git show "origin/insta-media:$key/post.json" | jq -r '.caption' | sed '1s/^/🎬 30초 요약 | /' > /tmp/cap.txt
  npx tsx scripts/insta/reel-make.ts "$dir" /tmp/reel.mp4
  say "대체 릴스(카드 $key, ${n}장): $(bash scripts/insta/reel.sh "$(upload /tmp/reel.mp4 "$D-cards")" /tmp/cap.txt)"
}

POSTS="$POST"
if [ -z "$POSTS" ]; then POSTS=$(jq -r --arg d "$D" '.[$d] // empty | if type == "array" then .[] else . end' media/insta/reel-queue.json 2>/dev/null || true); fi
if [ -n "$POSTS" ]; then
  rc=0
  for POST in $POSTS; do
    main_post && continue
    say "경고: $POST 게시 실패 → 카드 세트로 대체 릴스(오늘 릴스가 하나도 없을 때만)"
    cards_post || rc=1
  done
  exit $rc
fi
if [ "$FALLBACK" = true ]; then cards_post; exit $?; fi
say "오늘 예약 릴스 없음(15:00 KST 에 없으면 카드 세트로 대체)"

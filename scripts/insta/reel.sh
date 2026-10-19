#!/usr/bin/env bash
# 인스타 릴스 게시: reel.sh <공개 영상 주소> <본문 파일>  → permalink JSON. 환경변수 TOKEN(출력 안 함), IG
set -euo pipefail
URL="$1"; CAPFILE="$2"
G="https://graph.facebook.com/v21.0"; AUTH="Authorization: Bearer $TOKEN"
ct=$(curl -sS -f -o /dev/null -w '%{content_type}' "$URL") || { echo "영상 주소 없음: $URL"; exit 1; }
[[ "$ct" == video/mp4* ]] || { echo "MP4 아님($ct)"; exit 1; }
cid=$(curl -sS -f -X POST -H "$AUTH" "$G/$IG/media" -d media_type=REELS --data-urlencode "video_url=$URL" --data-urlencode "caption=$(cat "$CAPFILE")" -d share_to_feed=true | jq -r .id)
for i in $(seq 1 60); do
  st=$(curl -sS -f -H "$AUTH" "$G/$cid?fields=status_code" | jq -r .status_code)
  [ "$st" = "FINISHED" ] && break; [ "$st" = "ERROR" ] && { curl -sS -H "$AUTH" "$G/$cid?fields=status" | jq -c .; exit 1; }; sleep 10
done
[ "$st" = "FINISHED" ] || { echo "영상 처리 시간 초과($st)"; exit 1; }
mid=$(curl -sS -f -X POST -H "$AUTH" "$G/$IG/media_publish" -d "creation_id=$cid" | jq -r .id)
curl -sS -f -H "$AUTH" "$G/$mid?fields=permalink,timestamp" | jq -c '{permalink, timestamp}'

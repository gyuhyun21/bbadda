#!/usr/bin/env bash
# 인스타 카루셀 게시: publish.sh <공개 이미지 주소 앞부분> <post.json>  → permalink JSON 출력
# 환경변수 TOKEN(페이지 토큰, 출력하지 않음), IG(인스타 계정 ID). post.json = { images: [파일…], caption }
set -euo pipefail
BASE="$1"; POSTJSON="$2"
G="https://graph.facebook.com/v21.0"; AUTH="Authorization: Bearer $TOKEN"
mapfile -t files < <(jq -r '.images[]' "$POSTJSON")
for f in "${files[@]}"; do
  ct=$(curl -sS -f -o /dev/null -w '%{content_type}' "$BASE/$f") || { echo "이미지 주소 없음: $BASE/$f"; exit 1; }
  [[ "$ct" == image/jpeg* ]] || { echo "JPEG 아님($ct): $BASE/$f"; exit 1; }
done
cap=$(jq -r .caption "$POSTJSON")
if [ "${#files[@]}" -gt 1 ]; then
  ids=()
  for f in "${files[@]}"; do ids+=("$(curl -sS -f -X POST -H "$AUTH" "$G/$IG/media" --data-urlencode "image_url=$BASE/$f" -d is_carousel_item=true | jq -r .id)"); done
  cid=$(curl -sS -f -X POST -H "$AUTH" "$G/$IG/media" -d media_type=CAROUSEL -d "children=$(IFS=,; echo "${ids[*]}")" --data-urlencode "caption=$cap" | jq -r .id)
else
  cid=$(curl -sS -f -X POST -H "$AUTH" "$G/$IG/media" --data-urlencode "image_url=$BASE/${files[0]}" --data-urlencode "caption=$cap" | jq -r .id)
fi
for i in $(seq 1 36); do
  st=$(curl -sS -f -H "$AUTH" "$G/$cid?fields=status_code" | jq -r .status_code)
  [ "$st" = "FINISHED" ] && break; [ "$st" = "ERROR" ] && { echo "컨테이너 오류"; exit 1; }; sleep 5
done
mid=$(curl -sS -f -X POST -H "$AUTH" "$G/$IG/media_publish" -d "creation_id=$cid" | jq -r .id)
curl -sS -f -H "$AUTH" "$G/$mid?fields=permalink,timestamp" | jq -c '{permalink, timestamp}'

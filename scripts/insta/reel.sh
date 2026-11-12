#!/usr/bin/env bash
# 인스타 릴스 게시: reel.sh <공개 영상 주소> <본문 파일> [reel.json]  → permalink JSON. 환경변수 TOKEN(출력 안 함), IG
# reel.json 에 igAudio 가 있으면 인스타 음원을 붙인다(Instagram Audio API, 2026-06-01 공개 · 2026-11-12 이사님 승인):
#   "igAudio": {"pick":"trending"}(검색어 없는 GET /ig_audio = 그날 유행 25곡 중 첫 곡) 또는 {"id":"<음원 id>"}, "audioVolume"(기본 30)·"videoVolume"(기본 100) 각 1~100
#   고른 곡은 표준 오류로 알린다. 곡 고르기·음원 붙인 게시 요청·그 영상 처리(ERROR) 중 하나라도 실패하면 음원 없이(목소리만) 다시 게시한다 — 그날 릴스를 빠뜨리지 않는다
set -euo pipefail
URL="$1"; CAPFILE="$2"; SPEC="${3:-}"
G="https://graph.facebook.com/v21.0"; AUTH="Authorization: Bearer $TOKEN"
ct=$(curl -sS -f -o /dev/null -w '%{content_type}' "$URL") || { echo "영상 주소 없음: $URL"; exit 1; }
[[ "$ct" == video/mp4* ]] || { echo "MP4 아님($ct)"; exit 1; }
audio=""
if [ -n "$SPEC" ] && [ -f "$SPEC" ] && jq -e '.igAudio | type == "object"' "$SPEC" >/dev/null; then
  aid=$(jq -r '.igAudio.id // empty' "$SPEC")
  if [ -z "$aid" ]; then
    # 토큰은 머리글로만 보낸다(주소·로그에 남지 않게)
    aid=$(curl -sS -f --max-time 30 -H "$AUTH" "$G/ig_audio?audio_type=music&user_id=$IG" | jq -r '.audio[0] | select(.) | "\(.audio_id)\t\(.title) — \(.display_artist // "")"') || aid=""
    [ -n "$aid" ] && echo "음원(유행 1위): ${aid#*$'\t'} (${aid%%$'\t'*})" >&2
    aid="${aid%%$'\t'*}"
  else echo "음원(지정): $aid" >&2
  fi
  if [ -n "$aid" ]; then
    audio=$(jq -c --arg id "$aid" '{audio_id: $id, audio_volume: (.audioVolume // 30), video_volume: (.videoVolume // 100)}
      | if ([.audio_volume, .video_volume] | all(type == "number" and . >= 1 and . <= 100 and . == floor)) then . else error("음량은 1~100 정수") end' "$SPEC") || { echo "경고: igAudio 음량 값이 잘못됨 — 음원 없이 게시" >&2; audio=""; }
  else echo "경고: 인스타 음원을 고르지 못함 — 음원 없이 게시" >&2
  fi
fi
create() { curl -sS -f -X POST -H "$AUTH" "$G/$IG/media" -d media_type=REELS --data-urlencode "video_url=$URL" --data-urlencode "caption=$(cat "$CAPFILE")" -d share_to_feed=true "$@" | jq -r .id; }
if [ -n "$audio" ]; then
  cid=$(create --data-urlencode "audio_configuration=$audio") || { echo "경고: 음원 붙인 게시 요청 실패 — 음원 없이 다시" >&2; cid=$(create); }
else cid=$(create)
fi
# 영상 처리 기다리기: 끝나면 0, ERROR 면 2, 시간 초과면 1. ERROR 상태는 음원이 없으면 표준 출력(예전 그대로), 음원을 썼으면 표준 오류(게시 결과 줄과 섞이지 않게)
if [ -n "$audio" ]; then exec 3>&2; else exec 3>&1; fi
wait_done() {
  for i in $(seq 1 60); do
    st=$(curl -sS -f -H "$AUTH" "$G/$cid?fields=status_code" | jq -r .status_code)
    [ "$st" = "FINISHED" ] && return 0; [ "$st" = "ERROR" ] && { curl -sS -H "$AUTH" "$G/$cid?fields=status" | jq -c . >&3; return 2; }; sleep 10
  done
  echo "영상 처리 시간 초과($st)"; return 1
}
rc=0; wait_done || rc=$?
# 음원 붙인 요청이 받아들여진 뒤 처리 중 ERROR 가 나도 음원 없이 한 번 다시(BUG-BB340-1, 2026-11-12 규엔)
if [ "$rc" = 2 ] && [ -n "$audio" ]; then echo "경고: 음원 붙인 영상 처리 오류 — 음원 없이 다시" >&2; cid=$(create); rc=0; wait_done || rc=$?; fi
[ "$rc" = 0 ] || exit 1
mid=$(curl -sS -f -X POST -H "$AUTH" "$G/$IG/media_publish" -d "creation_id=$cid" | jq -r .id)
curl -sS -f -H "$AUTH" "$G/$mid?fields=permalink,timestamp" | jq -c '{permalink, timestamp}'

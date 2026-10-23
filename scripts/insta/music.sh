#!/usr/bin/env bash
# 릴스에 배경음악 입히기: music.sh <영상.mp4> <곡 이름(scripts/insta/music/<이름>.mp3, 확장자 빼고)> <출력.mp4> [시작 초]
# 영상 길이에 맞춰 자르고, 소리 크기를 맞추고(-14 LUFS), 앞 0.2초·끝 1초 페이드. 원래 소리는 버린다
set -euo pipefail
IN="$1"; TRACK="$(dirname "$0")/music/$2.mp3"; OUT="$3"; START="${4:-0}"
[ -f "$TRACK" ] || { echo "곡 없음: $TRACK"; exit 1; }
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
fo=$(awk -v d="$d" 'BEGIN{printf "%.2f", (d>1.2?d-1:0)}')
ffmpeg -y -loglevel error -i "$IN" -ss "$START" -i "$TRACK" -map 0:v -map 1:a -c:v copy \
  -af "atrim=0:$d,asetpts=PTS-STARTPTS,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:d=0.2,afade=t=out:st=$fo:d=1" \
  -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"

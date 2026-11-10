#!/usr/bin/env bash
# 릴스 목소리(2026-11-10 주인 결정: Higgsfield → Google Cloud TTS, 목소리 Puck). 쓰기: tts-google.sh "<대본>" <출력.mp3>
# 키·설정: 환경변수 또는 저장소 .env 의 GOOGLE_TTS_API_KEY · TTS_RATE(기본 1.0) · TTS_VOICE(기본 Puck). 키는 출력하지 않는다(헤더로만, 명령줄에도 안 남게 보냄).
# 끝 코드: 0 성공 · 2 키 없음 · 1 오류 — 0 이 아니면 루틴은 목소리 없이 자막으로 만든다(docs/reel-routine.md 5단계).
set -uo pipefail
set +x  # bash -x 로 돌려도 키가 디버그 출력에 찍히지 않게
TEXT="${1:-}"; OUT="${2:-}"
[ -n "$TEXT" ] && [ -n "$OUT" ] || { echo "쓰기: tts-google.sh \"<대본>\" <출력.mp3>" >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# 값 읽기: 환경변수가 먼저, 없으면 저장소 .env 의 같은 이름 줄
envval() { local v="${!1:-}"; [ -z "$v" ] && [ -f "$ROOT/.env" ] && v="$(grep -E "^$1=" "$ROOT/.env" | tail -1 | cut -d= -f2- | tr -d "\"' \r")"; printf '%s' "$v"; }
VOICE="$(envval TTS_VOICE)"; VOICE="${VOICE:-ko-KR-Chirp3-HD-Puck}"
RATE="$(envval TTS_RATE)"; RATE="${RATE:-1.0}"  # 말 빠르기 기본 1.0 — 후처리 1.18배와 곱해 릴스 목소리 약 1.18배, 영상은 원속도(2026-11-10 이사님). 0.25~2.0
[[ "$RATE" =~ ^[0-9]+(\.[0-9]+)?$ ]] || { [ -n "$RATE" ] && echo "tts-google: TTS_RATE='$RATE' 숫자가 아님 — 1.0 으로 만든다" >&2; RATE=1.0; }
KEY="$(envval GOOGLE_TTS_API_KEY)"
[ -n "$KEY" ] || { echo "tts-google: GOOGLE_TTS_API_KEY 없음 — 목소리 없이 만든다" >&2; exit 2; }

BODY=$(TEXT="$TEXT" VOICE="$VOICE" RATE="$RATE" node -e 'const v=process.env.VOICE;process.stdout.write(JSON.stringify({input:{text:process.env.TEXT},voice:{languageCode:v.split("-").slice(0,2).join("-"),name:v},audioConfig:{audioEncoding:"MP3",speakingRate:Number(process.env.RATE)}}))')
RES=$(curl -sS --max-time 60 -H @<(printf 'x-goog-api-key: %s\n' "$KEY") -H 'Content-Type: application/json; charset=utf-8' \
  -d "$BODY" https://texttospeech.googleapis.com/v1/text:synthesize) || { echo "tts-google: 요청 실패" >&2; exit 1; }
# 응답의 audioContent(base64)를 mp3 로. 없으면 오류 문구만 보여 준다(응답에는 키가 없다)
printf '%s' "$RES" | OUT="$OUT" node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let j;try{j=JSON.parse(s)}catch{console.error("tts-google: 응답을 읽지 못함");process.exit(1)}
if(!j.audioContent){console.error("tts-google: 오류 —",j.error?.status??"",j.error?.message??"audioContent 없음");process.exit(1)}
const b=Buffer.from(j.audioContent,"base64");if(b.length<1000){console.error("tts-google: 파일이 너무 작음");process.exit(1)}
require("fs").writeFileSync(process.env.OUT,b)})'

#!/usr/bin/env bash
# 릴스 '우리 화면' 모션 장면 만들기(2026-11-26, 릴스 시험 PR #430): motion-render.sh <template> <props.json> <out.mp4> <초>
#   template: stat · compare · rank · quiz · board (scripts/insta/motion/src/Templates.tsx), 1080x1920 30fps 소리 없음
#   props.json: 템플릿별 값(docs/reel-routine.md 「우리 화면 템플릿」). 숫자는 그대로 보여 주기만 한다 — 계산은 루틴이 하고 캡션에 계산식
#   초: 장면 길이 = 그 장면 목소리 길이 + 0.3
# 맥 루틴이 reel.json 장면 {"kind":"motion","template":…,"props":{…}} 을 이걸로 motionN.mp4 로 만들어 커밋한다. Actions 에서는 돌리지 않는다.
# 처음 한 번: cd scripts/insta/motion && npm install. 크롬은 CHROME(없으면 맥 기본 Google Chrome 경로)
set -euo pipefail
die() { echo "motion-render: $*" >&2; exit 1; }
[ $# -eq 4 ] || die "쓰는 법: motion-render.sh <stat|compare|rank|quiz|board> <props.json> <out.mp4> <초>"
T="$1"; P="$2"; OUT="$3"; S="$4"
case "$T" in stat|compare|rank|quiz|board) ;; *) die "템플릿 이름 「$T」 — stat·compare·rank·quiz·board 중 하나";; esac
[ -f "$P" ] || die "props 파일 없음: $P"
[[ "$S" =~ ^[0-9]+(\.[0-9]+)?$ ]] && awk -v s="$S" 'BEGIN{exit !(s >= 1 && s <= 60)}' || die "초는 1~60 사이 숫자: $S"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"; M="$HERE/motion"
[ -d "$M/node_modules/remotion" ] || die "Remotion 이 없음 — 처음 한 번 cd scripts/insta/motion && npm install"
mkdir -p "$(dirname "$OUT")"; OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

TMP="$(mktemp -d /tmp/motion-render.XXXXXX)"; trap 'rm -rf "$TMP"; [ -z "${LOCKED:-}" ] || rmdir /tmp/bbadda-motion.lock 2>/dev/null || true' EXIT
node "$M/props.mjs" "$T" "$P" "$S" "$ROOT/config/teams.yaml" > "$TMP/props.json"

# Remotion 4.0.542 는 프로젝트 경로에 한글 등 ASCII 밖 글자가 있으면 렌더가 멈춘다 — 그때는 영문 경로 사본에서(두 번째부터는 바뀐 것만 복사)
W="$M"; PUB="$ROOT/public"
if LC_ALL=C grep -q '[^ -~]' <<<"$M"; then
  C="${MOTION_TMP:-/tmp/bbadda-motion}"; mkdir -p "$C/pub/fonts"
  rsync -a --delete "$M/" "$C/m/" && rsync -a --delete "$ROOT/public/fonts/pretendard" "$C/pub/fonts/"
  W="$C/m"; PUB="$C/pub"
fi
BROWSER=(); CH="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"; [ -x "$CH" ] && BROWSER=(--browser-executable="$CH")

# 크롬 두 개가 동시에 돌면 서로 부딪힌다 — 한 번에 하나(최대 10분 기다림)
for i in $(seq 1 120); do mkdir /tmp/bbadda-motion.lock 2>/dev/null && { LOCKED=1; break; }; [ "$i" = 120 ] && die "다른 렌더가 10분 넘게 끝나지 않음(/tmp/bbadda-motion.lock — 남은 렌더가 없으면 지운다)"; sleep 5; done
( cd "$W" && perl -e 'alarm shift; exec @ARGV' 600 npx remotion render src/index.ts "$T" "$TMP/out.mp4" --props="$TMP/props.json" --public-dir="$PUB" --muted --log=error ${BROWSER[@]+"${BROWSER[@]}"} ) || die "렌더 실패(10분 제한이면 종료 코드 142)"
mv "$TMP/out.mp4" "$OUT"

if command -v ffprobe >/dev/null; then
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
  awk -v d="$d" -v s="$S" 'BEGIN{x=d-s; if (x<0) x=-x; exit !(x > 0.1)}' && echo "경고: 길이 ${d}초 — 요청 ${S}초와 0.1초 넘게 다름" >&2
fi
echo "$OUT"

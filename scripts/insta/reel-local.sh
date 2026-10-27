#!/bin/zsh -l
# 맥미니 릴스 실행(2026-10-26 주인 결정): launchd com.bbadda.reel 이 매일 07:17 · 오후(평일 17:17/주말 13:17) · 22:45 KST 에 부른다(2026-10-27 주인 결정: 하루 3칸). docs/reel-routine.md 맨 위 '맥 실행'.
# 전용 사본에서 main 을 받아 Claude Code 를 헤드리스로 돌린다. 기록은 ~/Library/Logs/bbadda-reel.log
set -u
# 칸: 인자(아침|오후|저녁) 또는 실행 시각으로 정한다(12시 전 아침, 12~21시 오후, 그 뒤 저녁)
H=$(TZ=Asia/Seoul date +%-H)
SLOT="${1:-}"
[ -z "$SLOT" ] && { if [ "$H" -lt 12 ]; then SLOT=아침; elif [ "$H" -lt 21 ]; then SLOT=오후; else SLOT=저녁; fi; }
REPO="${BBADDA_REEL_REPO:-$HOME/mac-mini21/projects/BBADDA-reel}"
LOG="$HOME/Library/Logs/bbadda-reel.log"
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$HOME/.local/node-current:$PATH"
export CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
{
  echo "=== $(TZ=Asia/Seoul date '+%F %T') 시작 (칸: $SLOT)"
  cd "$REPO" || exit 1
  git checkout -q main && git reset -q --hard && git clean -qfd && git pull -q origin main || { echo "git 실패"; exit 1; }
  npm ci --silent >/dev/null 2>&1 || echo "npm ci 실패(이전 node_modules 로 계속)"
  claude -p "너는 BBADDA(빠따닷컴)의 릴스 편집자다. 저장소의 CLAUDE.md 를 읽고, docs/reel-routine.md 의 코드 블록 안 프롬프트를 지금 실행할 지시로 삼아 그대로 수행한다. 지금 칸은 ${SLOT}이다(0단계의 칸 S). 지금은 맥 실행이다(3-2 실제 영상 단계를 쓴다). Higgsfield 도구는 ToolSearch 로 불러 쓴다." \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,ToolSearch,mcp__claude_ai_Higgsfield__*"
  echo "=== $(TZ=Asia/Seoul date '+%F %T') 끝 ($?)"
} >> "$LOG" 2>&1

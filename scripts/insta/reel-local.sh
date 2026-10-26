#!/bin/zsh -l
# 맥미니 릴스 실행(2026-10-26 주인 결정): launchd com.bbadda.reel 이 매일 10:17·23:07 KST 에 부른다. docs/reel-routine.md 맨 위 '맥 실행'.
# 전용 사본에서 main 을 받아 Claude Code 를 헤드리스로 돌린다. 기록은 ~/Library/Logs/bbadda-reel.log
set -u
REPO="${BBADDA_REEL_REPO:-$HOME/mac-mini21/projects/BBADDA-reel}"
LOG="$HOME/Library/Logs/bbadda-reel.log"
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$HOME/.local/node-current:$PATH"
export CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
{
  echo "=== $(TZ=Asia/Seoul date '+%F %T') 시작"
  cd "$REPO" || exit 1
  git checkout -q main && git reset -q --hard && git clean -qfd && git pull -q origin main || { echo "git 실패"; exit 1; }
  npm ci --silent >/dev/null 2>&1 || echo "npm ci 실패(이전 node_modules 로 계속)"
  claude -p "너는 BBADDA(빠따닷컴)의 릴스 편집자다. 저장소의 CLAUDE.md 를 읽고, docs/reel-routine.md 의 코드 블록 안 프롬프트를 지금 실행할 지시로 삼아 그대로 수행한다. 지금은 맥 실행이다(3-2 실제 영상 단계를 쓴다). Higgsfield 도구는 ToolSearch 로 불러 쓴다." \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,ToolSearch,mcp__claude_ai_Higgsfield__*"
  echo "=== $(TZ=Asia/Seoul date '+%F %T') 끝 ($?)"
} >> "$LOG" 2>&1

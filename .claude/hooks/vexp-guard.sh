#!/bin/bash
# vexp-guard: block Grep/Glob when vexp daemon is available
# Fast path: if socket file doesn't exist, allow immediately.
# If socket file exists, verify daemon is actually listening (handles stale sockets after kill -9).
SOCK="${CLAUDE_PROJECT_DIR:-.}/.vexp/daemon.sock"
if [ -S "$SOCK" ] && python3 -c "
import socket,sys
s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
s.settimeout(0.5)
s.connect(sys.argv[1])
s.close()
" "$SOCK" 2>/dev/null; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"vexp daemon is running. Use run_pipeline instead of Grep/Glob."}}'
else
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"vexp daemon unavailable, falling back to Grep/Glob."}}'
fi
exit 0

#!/usr/bin/env bash
# PreToolUse guard: Omer writes every line under src/. Claude may not. tests/ is open to Claude (2026-10-14).
# Reads the hook JSON on stdin. Denies Write/Edit/NotebookEdit targeting those
# directories, and Bash commands whose write target is inside them. Reads stay
# allowed, and so does prose or config that merely mentions the directories.
set -euo pipefail
input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")
root="${CLAUDE_PROJECT_DIR:-$PWD}"
protected='^src(/|$)'

deny() {
  jq -cn --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

normalize() {
  local t="$1"
  t="${t//\"/}"; t="${t//\'/}"
  t="${t#"$root"/}"; t="${t#\$PWD/}"; t="${t#\$CLAUDE_PROJECT_DIR/}"; t="${t#./}"
  printf '%s' "$t"
}

case "$tool" in
  Write|Edit|NotebookEdit)
    path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")
    [ -z "$path" ] && exit 0
    rel=$(normalize "$path")
    if [[ "$rel" =~ $protected ]]; then
      deny "Blocked: $rel is under src/. Omer writes all source code. Propose the change and let Omer type it."
    fi
    ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
    # Candidate targets: the operands that follow a redirect or a mutating command,
    # up to the next pipe, semicolon or ampersand. Heredoc bodies and prose that
    # mention src/ are not operands and are not inspected.
    operands=$(grep -oE '(>>?|\b(tee|rm|rmdir|touch|mkdir|cp|mv|sed|perl)\b)[^|;&]*' <<<"$cmd" | tr ' \t' '\n\n' || true)
    while IFS= read -r t; do
      [ -z "$t" ] && continue
      case "$t" in '>'|'>>'|-*|tee|rm|rmdir|touch|mkdir|cp|mv|sed|perl|'<<'*) continue;; esac
      t=$(normalize "$t")
      if [[ "$t" =~ $protected ]]; then
        deny "Blocked: this command writes to $t, under src/. Omer writes all source code. Read-only commands on those paths are fine."
      fi
    done <<<"$operands"
    ;;
esac
exit 0

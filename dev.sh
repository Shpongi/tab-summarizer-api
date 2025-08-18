#!/usr/bin/env bash
set -euo pipefail

# --- Load .env.local if exists ---
if [[ -f ".env.local" ]]; then
  # load non-comment, non-empty lines of KEY=VALUE (no spaces around '=')
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.local | xargs)
fi

# --- Quick sanity print (lengths only) ---
len() { [[ -n "${1-}" ]] && printf "%s" "$1" | wc -c | tr -d '[:space:]' || printf "0"; }
echo "ENV check:"
echo "  OPENAI_API_KEY          len: $(len "${OPENAI_API_KEY-}")"
echo "  TELEGRAM_BOT_TOKEN      len: $(len "${TELEGRAM_BOT_TOKEN-}")"
echo "  TELEGRAM_CHAT_ID        len: $(len "${TELEGRAM_CHAT_ID-}")"

# Fail early if missing
[[ -z "${OPENAI_API_KEY-}" ]] && { echo "Missing OPENAI_API_KEY"; exit 1; }
[[ -z "${TELEGRAM_BOT_TOKEN-}" ]] && { echo "Missing TELEGRAM_BOT_TOKEN"; exit 1; }
[[ -z "${TELEGRAM_CHAT_ID-}" ]] && { echo "Missing TELEGRAM_CHAT_ID"; exit 1; }

# --- Run vercel dev ---
exec npx vercel dev

#!/usr/bin/env sh
# Creates the local test user against the running local Supabase (`supabase start`).
# Override with DEV_USER_EMAIL / DEV_USER_PASSWORD. Local only: it uses the
# service-role key printed by `supabase status`, which never leaves this machine.
set -eu

EMAIL="${DEV_USER_EMAIL:-dev@sledger.local}"
PASSWORD="${DEV_USER_PASSWORD:-sledger-dev-1234}"

STATUS="$(supabase status -o json 2>/dev/null)" || { echo "Supabase is not running. Run: supabase start" >&2; exit 1; }
API_URL="$(printf '%s' "$STATUS" | python3 -c 'import sys,json; print(json.load(sys.stdin)["API_URL"])')"
KEY="$(printf '%s' "$STATUS" | python3 -c 'import sys,json; print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')"

RESPONSE="$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")"

case "$RESPONSE" in
  *'"id"'*)               echo "Created $EMAIL (password: $PASSWORD)";;
  *already*|*registered*) echo "$EMAIL already exists (password: $PASSWORD)";;
  *)                      echo "Unexpected response: $RESPONSE" >&2; exit 1;;
esac
echo "Sign in at http://localhost:3000/login — accounts and categories are seeded on first sign-in."

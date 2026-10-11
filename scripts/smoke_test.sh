#!/usr/bin/env bash
# Quick end-to-end check that a running deployment really works.
#   ./scripts/smoke_test.sh http://localhost
# The same script is used by the pipeline after Docker Compose, after Kubernetes, and after the AWS deploy.
set -u
BASE="${1:-http://localhost}"
FAILED=0

# check <description> <expected HTTP status> <curl args...>
check() {
  local desc="$1" expected="$2"; shift 2
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@")
  if [ "$status" = "$expected" ]; then
    echo "PASS  $desc ($status)"
  else
    echo "FAIL  $desc - expected $expected, got $status"
    FAILED=1
  fi
}

echo "Smoke testing $BASE"

# Wait up to 120s for the API to report ready (a fresh deploy may still be starting up)
for i in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$BASE/api/ready")" = "200" ] && break
  sleep 2
done

check "frontend home page loads"           200 "$BASE/"
check "login page loads"                   200 "$BASE/login"
check "API health (liveness)"              200 "$BASE/api/health"
check "API ready (database reachable)"     200 "$BASE/api/ready"
check "protected route needs a token"      401 "$BASE/api/courses"
check "unknown API route returns 404"      404 "$BASE/api/does-not-exist"
check "/metrics is NOT public"             404 "$BASE/metrics"

# Real user journey: sign up -> log in -> use the token -> wrong password is refused
EMAIL="smoke$(date +%s)$RANDOM@example.com"
JSON='Content-Type: application/json'
check "sign up a new student" 201 -X POST "$BASE/api/auth/signup" -H "$JSON" \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"Smoke@1234\",\"role\":\"student\"}"

LOGIN=$(curl -s --max-time 10 -X POST "$BASE/api/auth/login" -H "$JSON" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Smoke@1234\"}")
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then
  echo "PASS  login returns a token"
  check "token opens a protected route"    200 "$BASE/api/courses" -H "Authorization: Bearer $TOKEN"
  check "token is verified by the API"     200 "$BASE/api/auth/verify" -H "Authorization: Bearer $TOKEN"
else
  echo "FAIL  login did not return a token"; FAILED=1
fi

check "wrong password is refused" 401 -X POST "$BASE/api/auth/login" -H "$JSON" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-password\"}"

if [ "$FAILED" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "SMOKE TEST FAILED"; fi
exit "$FAILED"

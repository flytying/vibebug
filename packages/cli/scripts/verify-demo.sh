#!/usr/bin/env bash
set -euo pipefail

echo "=== VibeBug Demo Verification ==="
echo ""

# 1. Check seed data
echo "1. Checking database..."
if [ ! -f .vibebug/vibebug.db ]; then
  echo "   FAIL: .vibebug/vibebug.db not found. Run the seed script first."
  exit 1
fi

ISSUE_COUNT=$(sqlite3 .vibebug/vibebug.db "SELECT count(*) FROM issues")
OCC_COUNT=$(sqlite3 .vibebug/vibebug.db "SELECT count(*) FROM occurrences")
RUN_COUNT=$(sqlite3 .vibebug/vibebug.db "SELECT count(*) FROM run_log")
FIX_COUNT=$(sqlite3 .vibebug/vibebug.db "SELECT count(*) FROM fix_attempts")
REG_COUNT=$(sqlite3 .vibebug/vibebug.db "SELECT count(*) FROM issues WHERE regression_flag = 1")

echo "   Issues:       $ISSUE_COUNT (expect 14)"
echo "   Occurrences:  $OCC_COUNT (expect ~62)"
echo "   Run log:      $RUN_COUNT (expect ~150+)"
echo "   Fix attempts: $FIX_COUNT (expect 7)"
echo "   Regressions:  $REG_COUNT (expect 3)"
echo ""

# 2. Check summary output
echo "2. Running vb summary..."
SUMMARY=$(vb summary 2>/dev/null || true)

if [ -z "$SUMMARY" ]; then
  echo "   FAIL: vb summary produced no output"
else
  echo "$SUMMARY" | head -25
  echo ""

  # Check no absolute paths leaked
  if echo "$SUMMARY" | grep -qE '/Users/|/home/'; then
    echo "   FAIL: Absolute paths found in summary output!"
  else
    echo "   PASS: No absolute paths in summary output"
  fi

  # Check summary contains key sections
  for section in "Top recurring" "Most expensive" "Regressions" "Top failing"; do
    if echo "$SUMMARY" | grep -q "$section"; then
      echo "   PASS: Found '$section' section"
    else
      echo "   FAIL: Missing '$section' section"
    fi
  done
fi
echo ""

# 3. Check markdown summary
echo "3. Running vb summary --markdown..."
MD_SUMMARY=$(vb summary --markdown 2>/dev/null || true)

if echo "$MD_SUMMARY" | grep -q '# VibeBug Summary'; then
  echo "   PASS: Markdown summary has correct header"
else
  echo "   FAIL: Markdown summary missing header"
fi

if echo "$MD_SUMMARY" | grep -qE '/Users/|/home/'; then
  echo "   FAIL: Absolute paths found in markdown summary!"
else
  echo "   PASS: No absolute paths in markdown summary"
fi
echo ""

# 4. Check markdown export
echo "4. Running vb export --format markdown..."
MD_EXPORT=$(vb export --format markdown 2>/dev/null || true)

if echo "$MD_EXPORT" | grep -q '# VibeBug Report'; then
  echo "   PASS: Markdown export has correct header"
else
  echo "   FAIL: Markdown export missing header"
fi

if echo "$MD_EXPORT" | grep -q '| Title |'; then
  echo "   PASS: Markdown export has captures table"
else
  echo "   FAIL: Markdown export missing captures table"
fi

if echo "$MD_EXPORT" | grep -qE '/Users/|/home/'; then
  echo "   FAIL: Absolute paths found in markdown export!"
else
  echo "   PASS: No absolute paths in markdown export"
fi
echo ""

# 5. Check dashboard API (start, test, stop)
echo "5. Testing dashboard API..."
vb dash --no-open &
DASH_PID=$!
sleep 3

PASS=true
for endpoint in /api/project /api/stats /api/issues /api/insights; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:7600$endpoint" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "   PASS: $endpoint returned 200"
  else
    echo "   FAIL: $endpoint returned $STATUS"
    PASS=false
  fi
done

# Check stats trigger full layout
STATS=$(curl -s http://localhost:7600/api/stats 2>/dev/null || echo '{}')
TOTAL=$(echo "$STATS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('totalIssues',0))" 2>/dev/null || echo "0")
if [ "$TOTAL" -gt 3 ] 2>/dev/null; then
  echo "   PASS: totalIssues ($TOTAL) > 3 — full dashboard layout will render"
else
  echo "   FAIL: totalIssues ($TOTAL) <= 3 — dashboard will show minimal layout"
fi

OPD_COUNT=$(echo "$STATS" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('occurrencesPerDay',[])))" 2>/dev/null || echo "0")
echo "   INFO: Occurrences-per-day data points: $OPD_COUNT (expect 15-25)"

kill $DASH_PID 2>/dev/null
wait $DASH_PID 2>/dev/null || true
echo ""

echo "=== Verification Complete ==="

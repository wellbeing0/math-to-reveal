#!/usr/bin/env bash
set -euo pipefail

target="${1:-.}"

patterns=(
  "steveleclair.info"
  "/var/www"
  "README-private"
  "gemini-aoede"
  "GEMINI_API_KEY"
  "PEXELS_API_KEY"
)

status=0
for pattern in "${patterns[@]}"; do
  if grep -RIn --exclude=check-public-clean.sh --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=playwright-report --exclude-dir=test-results -- "${pattern}" "${target}" >/tmp/public-clean-hit.txt; then
    echo "Public-clean scan found: ${pattern}"
    cat /tmp/public-clean-hit.txt
    status=1
  fi
done

rm -f /tmp/public-clean-hit.txt
exit "${status}"

#!/usr/bin/env bash
set -euo pipefail

target="${1:-.}"

patterns=(
  "/var/www"
  "README-private"
  "gemini-aoede"
  "GEMINI_API_KEY"
  "PEXELS_API_KEY"
)

regex_patterns=(
  'AKIA[0-9A-Z]{16}'
  'AIza[0-9A-Za-z_-]{35}'
  'gh[pousr]_[0-9A-Za-z_]{30,}'
  'github_pat_[0-9A-Za-z_]{50,}'
  'sk-ant-[0-9A-Za-z_-]{20,}'
  'sk-[A-Za-z0-9]{32,}'
  'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
  '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----'
)

status=0
for pattern in "${patterns[@]}"; do
  if grep -RIn --exclude=check-public-clean.sh --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=output --exclude-dir=playwright-report --exclude-dir=test-results -- "${pattern}" "${target}" >/tmp/public-clean-hit.txt; then
    echo "Public-clean scan found: ${pattern}"
    cat /tmp/public-clean-hit.txt
    status=1
  fi
done

for pattern in "${regex_patterns[@]}"; do
  if grep -REIn --exclude=check-public-clean.sh --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=output --exclude-dir=playwright-report --exclude-dir=test-results -- "${pattern}" "${target}" >/tmp/public-clean-hit.txt; then
    echo "Public-clean regex found: ${pattern}"
    cat /tmp/public-clean-hit.txt
    status=1
  fi
done

rm -f /tmp/public-clean-hit.txt
exit "${status}"

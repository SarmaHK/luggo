#!/usr/bin/env node
/**
 * Sets up git hooks for this repository (once per clone).
 * Run: npm run setup:hooks
 */
const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '../../.git/hooks');
const hookSrc  = path.join(__dirname, 'pre-commit');
const hookDest = path.join(hooksDir, 'pre-commit');

if (!fs.existsSync(hooksDir)) {
  console.error('❌  .git/hooks directory not found. Are you inside a git repo?');
  process.exit(1);
}

const hookScript = `#!/bin/sh
# Gitleaks secret scan — installed by npm run setup:hooks
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "⚠️  gitleaks is not installed. Skipping secret scan."
  echo "   Install it: winget install Gitleaks.Gitleaks  (Windows)"
  echo "               brew install gitleaks              (Mac)"
  exit 0
fi

echo "🔍  Running Gitleaks secret scan on staged files…"
gitleaks protect --staged --redact --no-banner
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌  Gitleaks found potential secrets. Commit blocked."
  echo "   Read the finding above and remove the secret."
  echo "   Do NOT use --no-verify to bypass this check."
  echo "   Guide: docs/SECRET_SCANNING.md"
  exit 1
fi
echo "✅  No secrets detected."
`;

fs.writeFileSync(hookDest, hookScript, { mode: 0o755 });
console.log('✅  pre-commit hook installed at .git/hooks/pre-commit');
console.log('   Every commit will now be scanned for secrets by Gitleaks.');

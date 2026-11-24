# Secret Scanning with Gitleaks

This project uses [Gitleaks](https://github.com/gitleaks/gitleaks) to prevent secrets from being committed.

## Setup (once per clone)

```bash
# 1. Install Gitleaks
winget install Gitleaks.Gitleaks   # Windows
brew install gitleaks              # Mac

# 2. Enable the pre-commit hook
npm run setup:hooks

# 3. Verify
gitleaks version
npm run secrets:scan
```

## Rules

- **Never** put real API keys, passwords, or tokens in source code or in `.env.local.example`.
- Real values live only in:
  - `.env.local` — local dev (never committed, in `.gitignore`)
  - **Vercel** environment variables — production
- If a commit is blocked by Gitleaks, **read the message** and remove the secret. Do **not** use `--no-verify`.
- If you ever see a real secret in a scan finding, tell the team immediately. Do **not** paste it anywhere.

## Commands

| Command | Description |
|---|---|
| `npm run setup:hooks` | Install pre-commit hook (once per clone) |
| `npm run secrets:scan` | Scan entire git history for secrets |
| `gitleaks protect --staged` | Scan only staged files (what the hook does) |

## Expected Findings

Running `npm run secrets:scan` on the full history will show **~21 findings from old commits**. These are known historical findings — the values have been rotated and are redacted in output. No action is needed unless a **new** finding appears.

## How the Hook Works

The pre-commit hook (`scripts/hooks/setup-hooks.js`) installs a shell script at `.git/hooks/pre-commit`. On every `git commit`, it runs:

```
gitleaks protect --staged --redact --no-banner
```

This scans only the **staged** changes, not the full history, so it's fast.

## Rotating a Leaked Secret

If a real secret was committed:

1. Immediately revoke/rotate the secret in the service dashboard.
2. Remove it from the code and commit the fix.
3. Contact the team lead — do not paste the value in Slack/Discord/email.
4. Consider using `git filter-repo` to scrub the history if the commit was public.

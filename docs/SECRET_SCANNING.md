# Secret scanning (Gitleaks)

Luggo handles customer, partner and payment data. Credentials must never live in Git.
Gitleaks scans for them in three places: on your machine before each commit, on every
pull request, and weekly across the full Git history.

| Layer | What runs | Blocks |
|---|---|---|
| Pre-commit hook (`.githooks/pre-commit`) | `gitleaks git --pre-commit --staged` | the commit |
| GitHub Actions (`.github/workflows/gitleaks.yml`) | PR and push scan; weekly full-history scan | the PR, once it is a required check |
| `.gitignore` | `.env`, `.env.*` ignored (only `.env.local.example` is tracked) | accidental `git add` |

Configuration: `.gitleaks.toml` (official default rules plus one Luggo rule that catches
a literal value assigned to our server-only variables, e.g. `CRON_SECRET`).
Accepted false positives: `.gitleaksignore` (by fingerprint).

## Install (once per developer)

Needs Gitleaks v8.19 or newer.

| OS | Command |
|---|---|
| Windows | `winget install Gitleaks.Gitleaks` (or `scoop install gitleaks`) |
| macOS | `brew install gitleaks` |
| Linux | download the release from https://github.com/gitleaks/gitleaks/releases and put it on your `PATH` |

On Windows run git commands from Git Bash, PowerShell or an IDE terminal; the hook is a
plain `sh` script that Git for Windows runs itself. Then, in the repository:

```bash
npm run setup:hooks      # points git at .githooks (once per clone)
gitleaks version         # verify the install
npm run secrets:scan     # scan the full history; matches are redacted
```

Check the hook works with a throwaway random value (never a real credential):

```bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(16).toString('hex'))" > secret-test.txt
git add secret-test.txt
git commit -m "test"        # expect: blocked, finding shown redacted
git restore --staged secret-test.txt && rm secret-test.txt
```

## Local scanning

```bash
npm run secrets:scan          # everything in Git history (redacted)
npm run secrets:scan:staged   # only what you are about to commit
```

Never run Gitleaks with `--redact=0` or paste unredacted output into chats or tickets.

## CI

`Gitleaks secret scan` runs on pull requests, pushes to `main`, weekly (full history)
and on demand. The action runs with redaction, with PR comments and report artifacts
turned off, so finding text is not stored or posted. Actions are pinned to commit SHAs;
update them deliberately (see Maintenance).

The Gitleaks action is free for personal GitHub accounts. If the repository moves to a
GitHub organization, the action needs a licence key (secret `GITLEAKS_LICENSE`);
alternatively switch the step to the Gitleaks CLI.

### GitHub settings that cannot be set from the repository

An administrator must do these in GitHub (Settings of the repository):

1. **Branches > Add branch ruleset (or classic rule) for `main`**: require a pull
   request, and **require status checks to pass**: add `Gitleaks secret scan` and the
   checks from `CI` (the job is named `checks`). Require branches to be up to date.
   Include administrators.
2. **Code security**: enable **Secret scanning** and **Push protection** (free for
   public repositories). Enable Dependabot alerts.
3. **Actions > General**: set workflow permissions to read-only by default; allow only
   GitHub-owned and verified actions if possible.
4. **Collaborators and teams**: review who has write or admin access; remove anyone who
   does not need it. **Secrets and variables > Actions**: list the repository secrets and
   confirm each is still needed.
5. Check whether the repository is **public or private**. This decides how urgent the
   rotation below is.

## Handling a finding

False positive (verified, not a credential): add its fingerprint (the `Fingerprint:`
line of the finding, `commit:file:rule:line`) to `.gitleaksignore` with a comment saying
why, and get a second person to review. Do not add paths to the config allowlist, and do
not use `git commit --no-verify`.

Real credential: see the next section. Removing it from the file is not enough.

## If a secret is found: response procedure

Humans do every step. Tools and scripts must never rotate or delete production
credentials automatically.

1. **Identify** the credential (provider, environment, what it can do). Use the rule name
   and file in the redacted finding. Do not copy the value anywhere.
2. **Scope the exposure**: which commits and branches contain it, whether the repository
   is public, whether it was pushed, forked or built into a deployed bundle.
   Anything pushed to a remote counts as exposed, even if the commit is later deleted.
3. **Revoke or rotate** it at the provider (see table). Rotate first; clean history later.
4. **Update the secret store**: Vercel environment variables for the right environment,
   GitHub Actions secrets, and local `.env.local` files. Redeploy.
5. **Investigate misuse** using the provider's logs for the exposure window
   (Supabase logs and auth/user lists, PayHere transactions and merchant portal,
   mail account sign-in activity, SMS sender usage). Treat unexplained activity as an
   incident.
6. **Clean up Git history only after rotation** (history rewriting does not make a leaked
   secret safe). If you rewrite, coordinate with the whole team, then add the now-dead
   finding's fingerprint to `.gitleaksignore` so the history scan passes without hiding
   new leaks.
7. **Document**: date, credential type (not value), exposure window, who rotated it,
   evidence of misuse or none, and what prevents a repeat. Verify the next scan passes.

| Credential | Where to rotate |
|---|---|
| Supabase service-role / anon keys, JWT secret | Supabase dashboard > Project Settings > API (rotate the JWT secret or API keys). Rotating invalidates all user sessions, plan a maintenance window. |
| Database password | Supabase > Project Settings > Database |
| `PAYHERE_MERCHANT_SECRET` | PayHere merchant portal > Domains and credentials |
| `TEXTLK_API_TOKEN` | Text.lk dashboard |
| `EMAIL_PASS` (Gmail app password) | Google Account > Security > App passwords: revoke, create new |
| `CRON_SECRET`, `OTP_HASH_SECRET` | generate a new random value (for example `openssl rand -hex 32`), set in Vercel, redeploy |
| Seeded account passwords | change through the app or Supabase Auth |

## Production rules

- No credentials in source, tests, SQL, scripts, docs or `NEXT_PUBLIC_*` variables.
  Anything starting with `NEXT_PUBLIC_` is shipped to every browser. The Supabase
  **service-role key**, `PAYHERE_MERCHANT_SECRET`, `CRON_SECRET`, `OTP_HASH_SECRET`,
  `EMAIL_PASS`, `TEXTLK_API_TOKEN` and database credentials are server-only.
- Real values live in Vercel environment variables, scoped per environment. Use
  separate Supabase projects and keys for development, staging and production. Local
  development must never use production keys.
- `.env.local.example` holds placeholders only (`your-...`). Never paste a real value
  into it, even temporarily.

## Maintenance

- Update Gitleaks locally when Homebrew/winget offers a new version; keep v8.19+.
- Update pinned actions: look up the new release tag's commit SHA on the action's
  GitHub page, change the SHA and the version comment together, and run the workflow.
- Review `.gitleaksignore` quarterly; remove entries that no longer apply.
- Re-run `npm run secrets:scan` after any history rewrite.
- New server-only environment variable? Add its name to the `luggo-server-secret-assignment`
  rule in `.gitleaks.toml`.

## New developer checklist

1. Install Gitleaks; run `gitleaks version`.
2. `npm install`, then `npm run setup:hooks`.
3. Copy `.env.local.example` to `.env.local` and fill in development values only.
4. Make a test commit that stages a fake secret and confirm it is blocked.

# Version control standard

One standard for every Beyond app. The canonical copy is `standards/version-control/` in `YeahBuddyNZ/beyond-autopilot`. This file is a copy of it, so an app repo can be read on its own. Change the canonical one, then re-run `apply.sh` to refresh the copies.

## Where code lives

- Every app is a private GitHub repo under `YeahBuddyNZ`. The real code is never only on a laptop, in Replit, or in a chat.
- One app, one repo. Default branch is `main`.
- A repo that deploys on push to `main` (Beyond Family, the website, Beyond Ads) only ever gets changes through a pull request.

## Branches

- Work on a branch, never straight on `main`. Names: `feature/<short-name>`, `fix/<short-name>`, or `claude/<thread>` for Claude sessions.
- Unfinished work that must be saved goes on `wip/<short-name>` and is pushed at the end of every session. A pushed `wip/*` branch beats a clean local one nobody can see.
- Small, short-lived branches. Merge or close within a few days. Delete the branch after merge.

## Commits

- Commit after each working change. Push at least at the end of every session.
- Message format: what changed, why, and what was verified (and what was not). First line under 72 characters, present tense, for example `Add TestFlight link to apps page`.
- New Zealand English. No em dashes in messages or code comments.
- Never rewrite history on `main`, never force push a shared branch.
- One concern per commit. Do not mix a refactor with a feature.

## Pull requests

- Open the PR when the branch is pushed. Keep it ready for review, not a draft.
- Merge when checks are green. If a check is red, fix the work or the check, and say which. Never skip, delete or weaken a check to get green.
- A change to a database schema ships as a migration file in the same PR. A migration applied through a dashboard or connector is not done until its SQL file is committed.

## What must never be committed

Keys, signing files and anything that proves who we are:

- `.env` and `.env.*` (only `.env.example` with empty values is allowed)
- API keys, tokens, passwords, service role keys, webhook secrets
- Signing files: `*.keystore`, `*.jks`, `*.p12`, `*.p8`, `*.pfx`, `*.pem`, `*.key`, `*.mobileprovision`
- `config.properties` that holds a key (Beyond TV)
- Customer data, exports, database dumps
- Build output: `node_modules`, `*.apk`, `*.aab`, `*.ipa`, `*.xcarchive`, `DerivedData`

If a secret is committed by mistake, treat it as leaked: rotate it first, then remove it. Rewriting history does not un-leak it.

Where secrets live instead: the platform (Vercel, Supabase, Render), Xcode Cloud, or GitHub Actions secrets. Report a secret as set or missing, never print its value.

## The guard

Each repo carries two small files and a gitignore block:

- `scripts/check-secrets.sh`: scans staged files (or everything tracked with `--all`) for forbidden file names and key patterns. Exit 1 means stop.
- `.githooks/pre-commit`: runs it before every commit. Turn it on once per clone with `git config core.hooksPath .githooks`.
- `.gitignore`: a marked block ("Beyond version control standard") that is safe to re-run.

To allow a deliberate false positive, add `# secrets-ok` on that line with a reason. Never edit the script to make it pass.

## Design principles

- Apple platform apps (iPhone, iPad, Apple TV, Mac, Vision) follow Apple's Human Interface Guidelines. Start from the design principles page and read the platform page for the thing you are building: https://developer.apple.com/design/human-interface-guidelines/design-principles
- Web and in-app web UI uses ReUI only (`npx shadcn@latest add @reui/<item>`). No second component library.
- Keep targets finger sized, text readable at larger sizes, and everything usable with VoiceOver. On TV, everything works with the remote and something always has focus.
- Beyond is a trade mark: customer-facing copy writes Beyond™.

## New repo checklist

1. Create it private under `YeahBuddyNZ`, default branch `main`.
2. Run `bash apply.sh /path/to/repo` from `beyond-autopilot/standards/version-control/`.
3. Run `git config core.hooksPath .githooks` in each clone.
4. Commit on a branch, open a PR, merge when green.

---
name: beyond-traps
description: Known traps from Beyond's projects on Supabase, Postgres, Vercel, Render, Netlify, Astro, Next.js, Resend, Stripe and Claude Code cloud sessions, each with the symptom and the fix. Use before writing a connection string, configuring auth or magic links, adding or changing env vars, writing or applying a migration, verifying RLS, adding CSRF or proxy handling, deploying, or debugging a deploy that will not go green. Also use when a Supabase, Vercel or Render error looks like a firewall, a missing env var, a silent no-op, or "it works locally". Read it in the first hour on any new project. Not a style guide and not a substitute for the project's own CLAUDE.md.
---

# Traps that have already cost a day

Every entry here broke a real Beyond project at least once. Format: the trap, what it looks like, what to do. Sources are the repos where it was written down. When you hit a new one, `/lesson` it into the project's `## Project` section under a "Traps" heading, and propose it here if it is general.

## Supabase and Postgres

- **Direct host is IPv6 only.** `db.<ref>.supabase.co` is unreachable from Render and Vercel; `ENETUNREACH` looks like a firewall. Use the pooler host (`aws-0-<region>.pooler.supabase.com`). Note the exact pooler host in the Project section; `aws-0` and `aws-1` are different. (Workshop-OS, SEP-Quoting, momentum, Stafford, TRBR, BeyondFacelessApp)
- **Port decides the mode.** 6543 is transaction mode: fine for request handlers, breaks prepared statements, advisory locks, `LISTEN`, pg-boss and most migration tools. 5432 is session mode. Migrations and workers use 5432. (BeyondFacelessApp, replit-to-supabase migration)
- **node-postgres against the pooler needs `?sslmode=no-verify`** or it fails the certificate chain. (Workshop-OS, SEP-Quoting, momentum)
- **Never verify RLS as `postgres` or with the service role.** Both bypass RLS, so every check passes and one tenant's rows leak to another with no error. Verify as `authenticated` or `anon` from a second tenant. (Workshop-OS, muster, handrail)
- **A denied RLS read or write returns success with zero rows.** Only a blocked INSERT throws. Count affected rows after every write; an update that "worked" with zero rows is a denied update. (beyond-portal, nzcreditsolutions, TRBR)
- **RLS is written first, not last.** Every new table gets its policies in the same migration and every policy gets a test from a second role (PGlite or pgTAP). "We will add RLS later" has shipped public data. (muster, Workshop-OS, handrail, Beyond-Ajax-Configurator)
- **The service role key never reaches a client bundle.** Not in `NEXT_PUBLIC_*`, `PUBLIC_*` or `VITE_*`, not imported by anything that reaches the browser. Some projects deliberately have no service role key at all. (handrail, muster, momentum, Mario's Plumbing, tr-building-removals)
- **A migration applied through the MCP or the dashboard writes no file.** Production drifts ahead of the repo until someone commits the SQL. Commit the migration file in the same change, every time, and never edit a migration that has run. (Mario's Plumbing, TRBR, Beyond-Funnel, Beyond-Desk, handrail)
- **Dashboard settings do not travel with migrations.** Auth redirect URLs (add every deployment URL or magic links fail silently), site URL, email provider, OTP expiry, rate limits. Record each one in the Project section with how it fails when wrong. (handrail, muster, Beyond-Funnel, BeyondFacelessApp)
- **Built-in auth email is throttled** to a handful of messages per hour. Point auth email at Resend before relying on sign-in for real users. (handrail, Beyond-Funnel, BeyondFacelessApp)
- **Verify a magic-link or OTP in the browser, never in a server route.** Mail scanners fetch links and burn the token before the user does. (muster)
- **Never restate a table's shape by hand.** Import the generated types. Three wrong column assumptions shipped in one week from hand-written shapes. (Workshop-OS)
- **A JS `Date` or array inside a raw `sql` fragment fails at runtime**, not at compile time. Pass ISO strings and parameters. (TRBR, momentum, Workshop-OS)
- **Pools need timeouts.** A query that hangs is worse than one that fails; one pool per process; on serverless, no in-process state at all. Point uptime monitors at a route that touches the database, never a static health route. (momentum, SEP-Quoting, WekaCoffeeTracker, replit-to-supabase migration)
- **Schema that lives only in production cannot be tested.** CI should build a throwaway Postgres from the migrations. (Workshop-OS)
- **Column-level grants and `SECURITY DEFINER` linter warnings may be intentional** where the project documents them. Do not "fix" them without reading why. (Mario's Plumbing, Beyond-Funnel)

## Vercel

- **The git author email must belong to a GitHub account.** With email privacy on, a personal address fails the push (GH007) after the work is done, and Vercel silently refuses to deploy a commit whose author it cannot match. Use the account's `<id>+<user>@users.noreply.github.com` address. Never change the author to make a push go through; ask. (beyond-portal, TRBR, Stafford, momentum, BeyondFacelessApp)
- **`NEXT_PUBLIC_*`, `PUBLIC_*` and `VITE_*` are inlined at build time.** Changing one needs a rebuild, not a restart. Absent at build, they compile to empty strings, which once served every admin screen to anyone with the URL. Fail closed: a missing build-time value should 503 in production. (Mario's Plumbing, Beyond-Funnel, BeyondFacelessApp)
- **Serverless has no disk, no git and a 4.5 MB request body cap.** `data/*.json` is not there at runtime; deferred writes use `after()` from `next/server`, never a bare un-awaited promise (that silently dropped every visit record). (SEP-Quoting, WekaCoffeeTracker, Beyond-Funnel)
- **Pin the adapter major to the framework major.** `pnpm add @astrojs/vercel` took a version whose peer was the next Astro. (tr-building-removals)
- **A catch-all `[[...path]]` matched one segment** until the rewrite was fixed. Test nested routes after any routing change. (TRBR)
- **Ask for the actual build or runtime log before forming a theory.** (Stafford)
- **Give a deploy three minutes before checking it, and confirm the effect, not the gesture.** A fetch is not a page load; a 200 from a static route proves nothing. (TRBR, momentum, handrail)

## Render

- **Free tier sleeps.** Starter for anything a customer will open. (Mario's Plumbing, TRBR, BeyondFacelessApp)
- **`autoDeploy: true` means every push to main is live in about two minutes** with no staging. Know this before you push. (momentum)
- **Behind Render's TLS-terminating proxy, Astro's built-in CSRF origin check fails**, and Astro builds `url.host` with Render's internal port. Compare hostnames from `x-forwarded-host` in middleware instead. (Mario's Plumbing, tr-building-removals)
- **`PUT /env-vars` replaces the whole set.** Never send a partial list. (replit-to-supabase migration)
- **Set `HOST=0.0.0.0` and never set `PORT` yourself.** Pick the region nearest the users (Singapore or Sydney). If the app has a per-process cache, `numInstances: 1`. (Mario's Plumbing)

## Astro

- **`import.meta.env.PUBLIC_*` is build time.** Same trap as Vercel above. (Mario's Plumbing)
- **Whitespace before an inline tag in JSX changes rendering.** Bitten twice. (Mario's Plumbing)
- **Macrons need the `latin-ext` font subset.** Without it te reo Māori words render in a fallback font. (tr-building-removals)
- **Placeholder markers render as body text.** `{{TODO: confirm}}` printed on eight live pages. Render placeholders through a component that is empty in production. (tr-building-removals)

## Next.js

- **A layout guard does not cover a server action.** Every server action re-checks auth. (Beyond-Funnel)
- **Next.js 16.3 and later generates `AGENTS.md` from `next dev`.** Import it from `CLAUDE.md` with `@` rather than copying framework rules by hand. (skills research, September 2026)
- **ReUI and shadcn: read the real props from the registry or MCP server before writing JSX.** No hex values in JSX, one UI library per project. (Beyond-Ajax-Configurator, muster, Beyond-Desk, beyond-portal, handrail)

## Package managers, CI and tests

- **`npm` can half-install and exit 0.** Check the lockfile and the build, not the exit code. (Mario's Plumbing)
- **A relative import without `.js` kills a NodeNext deploy** while typecheck stays green. Test imports in CI. (momentum)
- **A pipe hides the exit code.** A lint failure was committed because `lint | tee` returned zero. Run gates one per line and read each. (Beyond-Desk)
- **Branch protection on a private repo needs GitHub Pro.** Ten commits merged past a red gate before anyone noticed. Check `.github/workflows` before believing any claim that a check is enforced. (Workshop-OS, beyond-portal)
- **Credential scanning only covers the file types it was told about.** Twice a real credential sat in the repo while the rule passed. Ask where a secret could live, not where you looked. (Rosco-Electrical)
- **Playwright reused a stale server** and an end-to-end suite probed a 404 page while reporting green. Assert on content, not status. (handrail)
- **Format with Prettier as its own commit** so the real diff stays readable. (Rosco-Electrical, WekaCoffeeTracker)

## Claude Code cloud sessions

- **Project hooks and settings load from the directory the session opens in.** A safety hook sat unplugged for nineteen days. The session-start check in this payload exists because of this. (TRBR)
- **Each repo gets its own cloud environment; the default environment stays empty.** A service role key once leaked into an unrelated project's environment. (muster)
- **Egress is filtered.** Report a secret as set or missing, never its value. Some hosts are unreachable; say so rather than claiming a check ran. (muster, nzcreditsolutions, Beyond-Ajax-Configurator, momentum)
- **The GitHub proxy refuses repository-settings writes** (rename, description, topics, branch protection) and serves only attached or public repos. Ask the owner for settings changes. (beyond-autopilot)
- **The GitHub archive host can 403 through a cloud proxy while git clone of the same public repo works.** `github.com/<owner>/<repo>/archive/<ref>.tar.gz` and `raw.githubusercontent.com` are blocked in some cloud sessions but not others, so a `curl | bash` installer that pulls a tarball fails unpredictably. Clone the public repo instead (the git proxy serves it), or use an installer that falls back to a clone. Beyond Autopilot's installer now does that fallback automatically. (beyond-autopilot, first real install on SEP-Quoting)
- **Verification scripts default to local; production has to be asked for by name.** (BeyondFacelessApp)
- **Check a handover document's date against `git log` before trusting a claim in it.** (nzcreditsolutions)

## Claude Code permissions

- **"Always allow, this project" empties the safety gate.** Each click promotes that operation into `.claude/settings.json`'s `allow`; enough clicks move the whole deploy/push/merge/migrate set out of `ask`, and the confirm-before-deploy layer is gone. Two installs reached that state. If you must widen permissions in a session, prefer the local scope (`.claude/settings.local.json`, gitignored) so it does not become the project's committed policy, and never move a write into `allow`. The session-start check warns when the gate looks stripped. (nzcreditsolutions, SEP-Quoting)
- **Stale connector names in `allow` cause a prompt storm.** Connector tool names are case-sensitive and they change (`mcp__vercel__` became `mcp__Vercel__`; Cloudflare is `mcp__Cloudflare_Developer_Platform__`). An `allow` entry that does not match the live name matches nothing, so every connector call prompts, and the prompts get clicked into `allow`. Pre-allow the current names, reads only, and let writes ask. (SEP-Quoting, beyond-autopilot)
- **A `settings.json` that is invalid JSON loads no permissions and no hooks.** A bad hand-merge left one project's file unparseable, so its guards were not running at all and nothing said so. The installer validates the file it writes, but a later hand-edit is not checked, so after editing it by hand run `node -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8"))'`. (SEP-Quoting)

## Money, facts and claims (New Zealand)

- **Money is integer cents, NZD, never a float.** GST is 15 percent, derived once at the total and stored separately. The server prices every order; never trust a price from a request. (Beyond-Ajax-Configurator, Workshop-OS, momentum, WekaCoffeeTracker, civil-plant-cost)
- **Missing data is never zero.** Render nothing and flag it. (civil-plant-cost)
- **Never invent a business fact:** a phone number, an address, a price, a spec, a project count, a date, a credential. An invented 0800 number was live for seven days; an invented phone number reached a stranger. Leave the field empty, mark it TBC, and put the question in `docs/open-questions.md`. (nzcreditsolutions, WekaCoffeeTracker, Mario's Plumbing, tr-building-removals, Beyond-Ajax-Configurator)
- **Consent is a timestamp, never a boolean.** (nzcreditsolutions)
- **Never claim an approval, a timeframe, an outcome or a clinical result the business cannot guarantee.** Regulated copy needs a human. (nzcreditsolutions, orewa-chiropractic)
- **Do not write te reo Māori copy yourself or generate it with a model.** (handrail)

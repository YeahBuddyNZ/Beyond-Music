---
name: review
description: Independent review pass over a change before it is called done. Use before saying a task is finished, before opening or updating a pull request, after a fix that took more than one attempt, and on any change that touches auth, permissions, RLS, money, migrations, deletes, or webhooks. Also use when asked "is this ready", "can I merge this", or "check my work". Not for reviewing someone else's design or for general code-quality tours of unchanged code.
argument-hint: [branch|range|PR]
---

Review target: $ARGUMENTS (blank means the working tree plus unpushed commits, compared with the default branch).

Review this as someone who did not write it. List first, fix after. Flag only what affects correctness, safety, or the stated requirements; do not propose rewrites of code that works.

1. Acceptance: find the plan in `docs/plans/` or the task as given. Quote each acceptance criterion and mark it met or not met, with the evidence (a command you ran and its output, a file and line, a screen you rendered). "Typechecks" and "tests pass" are evidence that it compiles and that the tests you have pass, not that the criterion is met.
2. Blast radius: for every function, endpoint or table whose behaviour changed, list its callers (grep for them). A caller that was not updated in this change is a finding.
3. Correctness: inputs that break it, error handling, empty and null cases, off-by-one, concurrency, time zones, money as floats.
4. Tests: do the new tests assert behaviour, or only that code ran? Would they fail if the change were reverted? If you can, revert the fix, run them, confirm they fail, restore. A stub more generous than the real code path is validating a fiction. Run the suite and say what ran and what did not.
5. Data safety: any query, migration or write against real data; any deletion; anything that cannot be undone; any migration applied through a connector that is not committed as a file.
6. Security: secrets in code, logs or client bundles; injection; auth boundaries (a layout guard does not cover a server action; a denied RLS write returns zero rows, not an error); new dependencies and why they are needed.
7. Architecture: does it respect the module boundaries and conventions already in this repo and in `docs/decisions` or `docs/adr`? Anything that works but violates the structure.
8. Reachability: a route, screen, job or flag with no caller or no entrance is not finished.
9. Scope: anything changed that the task did not ask for.
10. Adversarial pass: spend two minutes trying to break it as a hostile user or a flaky network would.

Output, in this order:

- Findings ranked by severity, each with `file:line`, a reproduction or the evidence, and a one-line fix. Anything you have not verified: say "unverified" and why, or leave it out.
- Verdict: ship / fix first / needs a human. Anything touching production data, money, auth or a legal or clinical claim is "needs a human" for the final call even when the code is right.
- Then fix every "fix first" item, re-run the tests, and give a two-line summary of what changed.
- Finally append one row to `docs/ai-process-audit/eval-log.md` for the task this change belongs to: date, task, model, payload version (from `.claude/autopilot.json`), whether the first attempt met the criteria, iterations, human interventions, tests that failed along the way, minutes, one-line note. Create the file with its header if it is missing.

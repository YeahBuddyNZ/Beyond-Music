---
name: plan
description: Write a durable implementation plan with acceptance criteria before building anything bigger than a small change. Use at the start of any task that touches more than one file, changes a data model, adds a route or screen, or will take more than about an hour. Also use when the request is vague ("improve the orders page") so the acceptance criteria settle what done means. Not for one-line fixes, typo corrections, or changes under about 50 lines.
argument-hint: [task in one line]
disable-model-invocation: true
---

Task: $ARGUMENTS

Plan before touching code. A plan that lives only in chat is lost at session end, so this one is a file.

1. Restate the task in one sentence. If it allows more than one reading, pick the most likely, say which, and carry on. Ask only if the readings lead to materially different work, and then ask one question with a recommended answer.
2. Inspect the existing system: the files and modules affected, the constraints and conventions that apply (including `CLAUDE.md` and `docs/decisions` or `docs/adr` if present), and which tests already cover the area. If `docs/open-questions.md` exists, check whether this task depends on an open question; if it does, stop and say so rather than guess.
3. Acceptance criteria: a numbered list of statements that can be checked objectively, phrased so that a stub or a hard-coded value could not satisfy them. Cover edge cases, and security, privacy or performance needs where they matter. This is how you will know you are finished.
4. Steps: ordered, each small enough to commit on its own, each with the command that verifies it. Keep the whole change under about 800 lines; if it will not fit, split the task and plan the first part only.
5. Risks, and what you will do about each. Name anything you will not be able to verify from this environment.
6. Out of scope: what you are deliberately not doing.

Save it as `docs/plans/<YYYY-MM-DD>-<short-slug>.md`, under 80 lines, with a `Status: open` line at the top. Commit it. Reference it from each commit message on this task (`Plan: docs/plans/...`).

If the task is small enough that the plan would be longer than the change, say so in one line and skip straight to building.

When the work is done, set `Status: closed` and add two or three lines under it on what differed from the plan and why.

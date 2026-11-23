---
name: lesson
description: Turn a correction or mistake into a durable control (a test, rule, hook or doc) so it cannot happen again. Use whenever the user corrects you, whenever you catch a mistake of your own, whenever a fix took more than two attempts, and whenever something that "should have worked" did not because of a platform quirk. Not for recording ordinary progress; that is the plan file or NOTES.md.
argument-hint: [what went wrong]
disable-model-invocation: true
---

What went wrong: $ARGUMENTS

A correction that lives only in this conversation is gone at session end. Convert it into something the next session cannot skip.

1. Classify the root cause. Pick one: model capability; missing context; poor instruction; missing tool; bad task decomposition; ambiguous requirement; missing validation; missing architectural constraint; missing feedback loop; excessive autonomy; insufficient autonomy.
2. Pick the matching control. Prefer enforcement over instruction. A rule that says what we meant is worse than no rule, because it stops anyone checking.
   - Missing validation: a test, lint rule, type, or hook. Then prove it can fail: plant the original bug, watch the check go red, remove it.
   - Missing architectural constraint: an architecture test or dependency rule, plus a short note in `docs/decisions` or `docs/adr`.
   - Missing context: the fact goes in the doc where the next session would look for it, or in the `## Project` section of `CLAUDE.md` if it is needed on almost every task. A platform quirk goes in the Project section under a "Traps" heading with the symptom and the fix.
   - Poor instruction: rewrite the rule in `CLAUDE.md`, shorter, with an example.
   - Ambiguous requirement: add the missing criterion to the plan, and note the pattern so `/plan` asks for it next time.
   - Excessive or insufficient autonomy: propose the exact `settings.json` line. Do not edit `.claude/` yourself; that is for a human to apply.
   - Model capability: split the task smaller, or note that a human does this step.
3. Sweep. A rule applied only where it was discovered is half a rule. Search the codebase for other instances of the same mistake and fix them in the same change.
4. Promotion rule. Only write a new always-on rule or a new skill when all three hold: a verification check exists and passes; the failure has a name and a reproduction; at least one plausible alternative explanation was ruled out. Otherwise record it as a lesson row only.
5. Append a row to `docs/ai-process-audit/lessons.md` (create it if needed): `date | what went wrong | root cause | control added | where`.
6. If the mistake was expensive, add a golden task to `docs/ai-process-audit/golden-tasks.md` so the next `/audit` measures whether it stays fixed.

Report: the control added, where it lives, and how you proved it catches the original mistake.

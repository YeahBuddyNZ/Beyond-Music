# Audit appendices

Referenced by `SKILL.md`. Appendix A anchors every score; Appendix B names every root cause; C holds the templates; D the anti-pattern catalogue; E the bar for a finding.

## Appendix A: Scoring anchors

| Score | Level | Meaning |
| --- | --- | --- |
| 1-2 | Absent / ad hoc | Nothing durable. Lives in chat or in someone's head. |
| 3-4 | Informal | Some artefacts exist. Used inconsistently. Not enforced. |
| 5-6 | Defined | Durable artefacts exist and are used most of the time. A human enforces them. |
| 7-8 | Enforced | Tooling enforces it. Independent verification exists. The feedback loop is mostly closed. |
| 9-10 | Measured | Metrics show it works. The process improves itself based on evidence. |

## Appendix B: Root cause taxonomy and matching controls

| Root cause | Definition | Control that usually fixes it |
| --- | --- | --- |
| Model capability | The model could not do it even with perfect context and instructions | Smaller task, different model, human does this step |
| Missing context | The information existed but was not in front of the AI | Move it to always-on or make it retrievable; fix the knowledge tree |
| Poor instruction | The AI was told, but told badly or ambiguously | Rewrite the instruction, add an example, or convert to a check |
| Poor Skill | A Skill fired but its procedure was wrong or incomplete | Fix or split the Skill; add validation to it |
| Missing tool | The AI could not inspect, run or check something it needed | Give it the tool (test runner, DB access, log access) |
| Bad task decomposition | The task was too big or wrongly split | Planning step, size limit, milestone structure |
| Ambiguous requirement | The requirement allowed more than one correct reading | Acceptance criteria, spec template, clarification gate |
| Missing validation | Nothing would have caught the error automatically | Test, type, lint, CI gate, hook |
| Missing architectural constraint | The rule existed nowhere the AI or tooling could see | ADR plus architecture test or dependency rule |
| Missing feedback loop | The same mistake happened before and nothing captured it | Failure runbook; convert corrections to controls |
| Excessive autonomy | The AI made a consequential decision it should have escalated | Permission boundary, approval gate |
| Insufficient autonomy | The human was a bottleneck on decisions the AI could make safely | Widen permissions where verification exists |

## Appendix C: Templates

### Golden task

```
id:            GT-03
title:         Add a filter parameter to the /orders endpoint
starting state: commit <hash> or branch <name>
task prompt:   <the exact prompt given to the AI>
success criteria:
  - endpoint accepts ?status= and filters correctly
  - existing tests pass
  - new test covers the filter
  - no import from api/ into domain/ (architecture rule)
verification:  <command that returns pass/fail>
timebox:       30 minutes
```

### Evaluation log row

```
date | task_id | model | instruction_version | skill_version | first_pass (y/n) | iterations | human_interventions | tests_failed | arch_violations | minutes | tokens | notes
```

### Failure record

```
id:          F-07
observed:    <what happened>
evidence:    <path, commit, transcript ref>
type:        <from Phase 3 list>
root cause:  <from Appendix B>
control:     <what would have prevented it, and where it goes>
cost:        <rough time lost>
golden task: <yes/no, and GT id if created>
```

## Appendix D: Anti-pattern catalogue

Name these when you see them. Each entry: what it looks like, why it hurts, the usual fix.

| Anti-pattern | What it looks like | Why it hurts | Usual fix |
| --- | --- | --- | --- |
| **Junk-drawer instructions** | One 400-line `CLAUDE.md` mixing rules, history, tips, TODOs and old decisions | Always-on tokens spent on irrelevant content; authoritative rules buried; conflicts go unnoticed | Split by knowledge type (Lens A); always-on file under 150 lines; link out |
| **README as Skill** | A Skill that is a description of a system, with no steps, inputs, outputs or validation | Fires but does not change behaviour; agent still improvises | Reclassify as Knowledge; move to docs; write a real procedure if one is needed |
| **Skill that never fires** | Trigger description too vague, too narrow, or overlapping with another Skill | Effort spent maintaining something that never runs | Fix the trigger, merge, or delete |
| **Plan in chat** | Implementation plans exist only in the conversation that produced them | Lost at session end; cannot be reviewed, referenced or compared to outcome | Plans as repo files with a lifecycle; commit references them |
| **Decorative ADR** | ADRs describe a decision but nothing enforces it and nothing references it | Architecture drifts anyway; ADRs become stale fiction | Pair each ADR with a constraint (test, lint rule, dependency rule) and cite it from the always-on file |
| **Verify by vibes** | "Looks correct", "should work", tests not run, or run but not gated | Errors surface at the next task or in production | Enforced gates; CI required status; hooks |
| **Test theatre** | Tests exist but assert nothing meaningful, mock the thing under test, or were generated after the fact to pass | False confidence; regressions pass | Mutation or spot check; golden tasks with real success criteria; test review in the checklist |
| **Iterate until green** | Fix chains of 3+ commits on the same files; "actually", "still" in commit messages | Wasted cycles; the root cause is usually missing context or validation, not model weakness | Diagnose from the histogram; add the missing control |
| **Correction amnesia** | Human fixes the same mistake repeatedly; nothing captures it | Human is the feedback loop | Failure runbook; convert corrections to tests, rules or instructions |
| **Head-only knowledge** | Domain rules, invariants and integration quirks exist only in the owner's head | AI guesses; owner reviews everything; bus factor of one | Externalise into domain docs and tests; interview the owner for the top ten invariants |
| **Approval fatigue** | Every trivial action requires human approval | Human rubber-stamps; the important approvals get no real attention | Widen permissions where verification exists; concentrate approval on consequential actions |
| **Unbounded task** | "Build the reporting module" given as one task | Large commits, reverts, half-finished work, architecture shortcuts | Planning step; size limits; milestones with acceptance criteria |
| **Stale truth** | Docs and instructions last edited long before the code they describe | AI follows rules that no longer apply; conflicts with code | Staleness check in Phase 0; ownership; delete or update |
| **Duplicated rule** | The same rule in the ADR, a Skill, the README and the prompt, with drift between copies | AI receives contradictory instructions; nobody knows which is authoritative | Single source of truth; others reference it |
| **Persona pile-up** | Five reviewer personas or agents with no evidence any catches what the builder missed | Cost and latency with no measured gain | One independent review pass with a checklist; add roles only where a failure class justifies them |
| **Unmeasured process** | Skills and prompts change constantly; no one knows if anything got better | Improvement is guesswork; regressions in process go unnoticed | Eval log; golden task suite; re-audit |

## Appendix E: Calibration examples

The bar for a finding and a recommendation. Match this quality.

**Weak finding:** "Documentation could be improved and the CLAUDE.md is quite long."

**Strong finding:** "`CLAUDE.md` is 412 lines `[evidence: CLAUDE.md]`. 140 lines are historical (migration notes from the Prisma to Drizzle move, `[evidence: CLAUDE.md:210-350]`), 60 lines duplicate rules already enforced by ESLint `[evidence: .eslintrc.cjs, CLAUDE.md:40-100]`, and the layering rule on line 22 contradicts ADR-004 `[evidence: docs/adr/004-api-layering.md]`. Anti-pattern: Junk-drawer instructions, Duplicated rule, Stale truth. Severity: high. Every task pays roughly 6k tokens for content that is either redundant or wrong."

**Weak recommendation:** "Add more tests and consider a review agent."

**Strong recommendation:** "R2. Enforce the domain/API boundary. Problem: 4 of 11 failure instances are architecture violations where API handlers import from the persistence layer directly `[evidence: F-02, F-05, F-08, F-11]`; ADR-004 states the rule but nothing checks it. Change: add `dependency-cruiser` with a rule forbidding `src/api/** → src/db/**`, run it in CI as a required check and in a pre-commit hook; cite the rule from the always-on file in one line and link to ADR-004. Mechanism: converts an instruction the AI forgets into a check it cannot skip. Effort: 2 hours. Risk: low; existing violations must be fixed first (4 files). Measurement: architecture violations per 10 tasks in the eval log, baseline 3.6, target 0 within 30 days."

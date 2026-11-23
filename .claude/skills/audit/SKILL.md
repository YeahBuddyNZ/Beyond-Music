---
name: audit
description: Audit the AI engineering process around this repo (not the product) and produce a ranked, evidence-cited list of the smallest changes that would make the AI materially better at building and maintaining it. Use when asked to audit, review or improve how the AI is used on a repo, when the same mistakes keep recurring, or every 60 to 90 days. Optional argument sets the mode: quick, full, re-audit or portfolio. Not for reviewing a single change; that is /review.
argument-hint: [quick|full|re-audit|portfolio]
disable-model-invocation: true
---

Mode requested: $ARGUMENTS (blank means Full). Read `docs/ai-process-audit/OWNER-INTAKE.md` first if it exists. The scoring anchors, root cause taxonomy, templates, anti-pattern catalogue and calibration examples are in `references/appendices.md` next to this file; read it before Phase 3.

# AI Engineering Process Audit

## 0. Mission

You are a Principal Engineer specialising in AI-assisted and agentic software engineering. You have been given a software system that was built using an AI-assisted development process.

Audit the **process**, not the product. Code quality is evidence about the process, not the subject of the review.

The one question you are answering:

> How effective is the AI engineering system around this codebase, where does it fail, and what is the **smallest** set of changes that would make the AI materially better at designing, implementing, testing and maintaining this system?

Your output must let the owner act on Monday morning. Findings without evidence, recommendations without a diagnosis, and advice without a way to measure it are all failures of this audit.

---

## 1. Rules of engagement

Read these before touching anything. They govern every judgement you make.

### 1.1 Evidence standard

- Every finding cites evidence. Use one of these forms inline: `[evidence: path/file.md:12-40]`, `[evidence: commit a1b2c3d]`, `[evidence: test_name]`, `[evidence: transcript 2026-08-14 turn 7]`.
- There are three states for anything you look for. Never blur them:
  - **Present**: you found it. Cite it.
  - **Absent**: you looked where it would live and it is not there. Say where you looked. Absent is a finding.
  - **Not visible**: it would live outside what you can see (the developer's head, chat history, a tool you cannot access). Not visible is a question for the owner, not a finding against them.
- Anything you infer rather than observe is tagged `[inferred, confidence: high|medium|low]`.
- Never invent process, history, intent or behaviour. If the artefacts do not show it, say so.

### 1.2 Principles

- The goal is the smallest, most effective engineering system that consistently causes the AI to produce high-quality software with minimal human intervention, while retaining human control over consequential decisions. It is not an elaborate AI framework.
- Durable engineering mechanisms beat conversational instructions.
- Automated verification beats AI self-confidence.
- Small, composable Skills beat giant instruction documents.
- Explicit acceptance criteria beat inferred requirements.
- Repository-specific evaluation beats generic benchmarks.
- More prompts is not a better process. More documentation is not better context.
- Do not recommend multi-agent architectures, extra personas or extra models unless a specific observed failure class justifies them.
- Distinguish model limitations from process limitations. Do not treat every AI mistake as a "better prompt" problem.
- Optimise for maximum reliable engineering throughput, not maximum autonomy.
- Actively hunt for: where the human is compensating for the process; repeated human corrections that should be automated controls; knowledge that lives only in heads or chats; overhead that should be deleted.
- Do not recommend anything because it is fashionable. Recommend it because the evidence says it will fix a failure you found.

### 1.3 Output discipline

- Findings before recommendations. Never recommend what you have not diagnosed.
- Rank ruthlessly. Ten ranked items beat forty unranked ones.
- Prefer a concrete draft artefact over a description of one.
- Calibrate depth to maturity. If the process is essentially absent, say so in a paragraph and spend the budget on what to build, not on scoring twenty capabilities at 1/10 in tedious detail.
- Be direct. No hedging, no praise padding, no "consider exploring".

---

## 2. Inputs

Work from whatever you are given, but ask for the following if missing and state at the top of the report which were available:

1. The repository (full git history)
2. All agent instruction files, Skills, rules, hooks, permissions and MCP config
3. ADRs, architecture docs, domain docs, plans, specs
4. CI configuration and recent CI logs
5. Issue tracker or task list
6. Session transcripts or conversation logs with the AI, if they exist
7. A list of the last ten tasks given to the AI and, in one line each, how they went

If you only have the repository, you can still do most of this audit. Lean harder on git analytics (Phase 0) and on the owner question list (Phase 7).

If `OWNER-INTAKE.md` exists in the audit directory, read it first. It answers most Not visible questions up front.

---

## 3. Modes

Pick the mode from the owner's instruction, or default to **Full**.

| Mode | When | What changes |
| --- | --- | --- |
| **Full** | First audit of a real project | Everything below |
| **Quick** | Small repo, side project, or a first look. Target under an hour of agent time | Phase 0 analytics, Phase 1 diagram only, Lenses A, D and E only, 5 failure instances, scorecard compressed to a paragraph, top 5 changes, drafts 1 and 5 only, main body under 2,000 words |
| **Re-audit** | A previous `audit-scorecard.yaml` exists | Run Full, then add a delta section: score movement per capability, which previous recommendations were adopted, which were not and why (ask), whether the failure histogram shifted, whether the eval log shows improvement. The delta section leads the executive summary |
| **Portfolio** | Owner has several repos built the same way | Run Quick on each, then a cross-repo section: findings common to all repos, shared instructions and Skills that should be extracted into one reusable base, and per-repo exceptions |

---

## 4. Execution plan

Work in phases. **Write each phase to disk before starting the next.** Context runs out; disk does not.

Effort guide for Full mode so you do not spend the whole budget on inventory: Phase 0 about 10%, Phase 1 about 10%, Phase 2 about 30%, Phase 3 about 20%, Phases 4 to 7 about 30%.

If your environment supports subagents, Phase 0 analytics is a good candidate to delegate so raw command output stays out of your main context. Keep diagnosis and recommendations in one context; splitting judgement across agents produces inconsistent findings.

Suggested layout:

```
docs/ai-process-audit/
  00-inventory.md
  01-current-process.md
  02-diagnosis.md
  03-failure-analysis.md
  04-recommendations.md
  drafts/                   (proposed artefacts, clearly labelled, not applied)
  AI-PROCESS-AUDIT.md       (final assembled report)
  QUESTIONS-FOR-OWNER.md
  audit-scorecard.yaml      (machine-readable scores, for re-audit comparison)
```

Do not modify any existing project file. Everything you produce lives under the audit directory.

---

## Phase 0: Inventory and environment detection

### 0.0 Size the project and set target maturity

Before scoring anything, establish what "good enough" means here. A solo side project and a regulated multi-team product should not be held to the same bar; recommending 9/10 everywhere is over-engineering and violates the principles.

Record: team size; who reviews AI output; release cadence; deployment target; users and data sensitivity; regulatory exposure; expected project lifespan; how much of the code the owner personally understands.

From this, set a **target maturity** (using Appendix A anchors) for each capability in the scorecard. Typical shapes:

- Solo developer, low-risk product: target 5 to 7 on verification, context and feedback; 3 to 5 elsewhere.
- Small team, customers depend on it: target 7 on verification, context, feedback, human oversight and guardrails; 5 to 6 elsewhere.
- Regulated or security-sensitive: target 7 to 8 across the board, 8 to 9 on verification, security review and guardrails.

Every gap in the scorecard is measured against the target, not against 10.

### 0.1 Detect the agent tooling in use

Check for the native mechanisms of each tool. Unused native mechanisms are often the cheapest wins.

| Tool | Look for |
| --- | --- |
| Claude Code | `CLAUDE.md` (root, nested, `~/.claude/`), `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/settings.json` (permissions, hooks), `.mcp.json` |
| Cursor | `.cursor/rules/*.mdc`, `.cursorrules` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` |
| Codex / generic | `AGENTS.md` |
| Others | Windsurf, Aider, Cline, Continue config files |

Output a table: tool detected, mechanism, used or unused, notes. For every unused mechanism, one line on what it could do here.

### 0.2 Artefact inventory

| Artefact | Location | State (Present / Absent / Not visible) | Last updated | Size | Notes |
| --- | --- | --- | --- | --- | --- |

Cover at least: repository instructions, Skills, path-scoped instructions, ADRs, architecture docs, domain docs, implementation plans, specs, tests by type, CI config, lint / format / type-check config, pre-commit hooks, security scanning, DB migrations, README, CHANGELOG, issue tracker references, conversation logs.

### 0.3 Repository analytics

Run these (adapt to the stack) and report the raw numbers, then what they suggest, tagged `[inferred]`.

- Commit count, date range, commits per week
- Fix ratio: commits matching `fix|revert|hotfix|oops|typo|again|actually|still` as a share of all commits
- Fix chains: sequences of 3+ consecutive commits touching the same files (signal of iterate-until-it-works)
- Churn hotspots: `git log --format= --name-only | sort | uniq -c | sort -rn | head -30`
- Large commits: commits touching more than 20 files; distribution of files-per-commit
- Test ratio: test files vs source files, test lines vs source lines, by module
- CI: present? what runs? does it gate merges? how often does it fail?
- Instruction weight: line and approximate token count of every always-on instruction file. Flag anything over 200 lines.
- Doc staleness: last-modified date of each instruction, ADR and doc versus the last code change in the area it governs
- Traceability: share of commits that reference a plan, issue, spec or ADR
- Dead weight: TODO / FIXME / HACK counts; commented-out code blocks; duplicated helper functions across modules

---

## Phase 1: Reconstruct the current process

Derive this from the artefacts. Do not assume.

### 1.1 Lifecycle table

| Stage | How it happens today | Evidence | Human decides | AI decides | Confidence |
| --- | --- | --- | --- | --- | --- |

Stages: requirements capture; requirements clarification; architecture establishment; architectural decision recording; project context delivery; repository context delivery; coding standards communication; domain knowledge communication; Skill structure and invocation; ADR influence on implementation; task breakdown; implementation planning; file selection; code generation; test generation; test execution; failure handling; code review; architecture conformance checking; documentation update; lesson retention; mistake prevention.

### 1.2 Workflow diagram

Draw the actual workflow as a Mermaid flowchart plus a plain-text chain. Use dashed nodes for stages that exist only as "the human does it in chat". Use a distinct style for stages that are enforced by tooling versus stages that depend on someone remembering.

### 1.3 The invisible layer

List everything you marked Not visible. For each: why it matters, and the exact question you would ask the owner. This feeds `QUESTIONS-FOR-OWNER.md`.

---

## Phase 2: Diagnose through eight lenses

For each lens, produce findings with evidence and a severity (critical / high / medium / low). Note where a finding also belongs to another lens rather than repeating it.

### Lens A: Context and knowledge architecture

The question: does the AI have the right information at the right time?

Look for: too little context; too much; irrelevant; duplicated; conflicting; stale; context that should be retrieved on demand rather than always loaded; context that should be encoded as a durable artefact; knowledge that exists only in conversations; knowledge that exists only in the developer's head.

Classify every knowledge artefact (or section of one) into:

- **Always-on**: needed for almost every task
- **Task-specific**: retrieved only when relevant
- **Authoritative**: rules the agent must obey
- **Informational**: background that must not be treated as a constraint
- **Historical**: why the system ended up this way
- **Uncertain**: still a decision, not an established fact

Identify where these are mixed together in one file.

Placement audit. For each rule or fact, record where it lives now and where it belongs:

| Item | Lives in | Belongs in | Duplicated in | Authoritative source should be |
| --- | --- | --- | --- | --- |

Destinations: repository instructions; `AGENTS.md` / `CLAUDE.md`; path-specific instructions; Skills; ADRs; architecture docs; domain docs; implementation plans; tests; code; configuration; task prompts.

Pay particular attention to duplication. Where the same rule appears in an ADR, a Skill, a system prompt, a README and a coding standard, name the single source of truth and what should reference it.

Memory. What survives when a session ends? Check: architectural decisions, domain rules, previous mistakes, coding conventions, known edge cases, implementation patterns, integration knowledge, operational knowledge, rejected approaches. List what is lost.

Output: the placement table, the loss list, and a proposed information architecture (a directory tree with one line per file saying what goes there and whether it is always-on or retrieved).

### Lens B: Skills and instructions

For every Skill and instruction file:

| Skill | Problem it solves | Trigger | Type | Scope verdict | Has examples | Has tooling | Defines validation | Defines failure handling | Conflicts | Hidden assumptions | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Type is one of: **Instruction**, **Procedure**, **Knowledge**, **Capability**, **Policy**. These should not all be represented the same way. Policies belong in always-on instructions or, better, in enforcement (lint, hook, test). Procedures belong in Skills with steps, inputs, outputs and validation. Knowledge belongs in retrievable docs. Capabilities belong in scripts and tools the agent can execute.

Test triggerability: would the Skill's description cause it to fire on the right task? Would it fire on the wrong one?

Verdict is one of: keep / split / merge / redesign / delete / convert to automation.

### Lens C: Requirements, planning and decomposition

Are requirements precise enough that the AI can objectively answer "am I finished?" Look for: ambiguity, missing acceptance criteria, missing edge cases, missing business rules, implicit assumptions, unstated invariants, missing non-functional, security and performance requirements.

Does the process push the AI through: understand the requirement → inspect the existing system → identify affected components → identify constraints → plan → identify risks → implement incrementally → verify → review own changes → update docs? Which steps are skipped, and what evidence shows it?

Which of these concepts exist in practice: task, subtask, implementation plan, milestone, dependency, acceptance criteria, definition of done?

Are plans transient conversation artefacts or durable project knowledge? If durable: are they versioned, reviewed, and referenced from commits?

Find tasks that were too large for reliable autonomous execution (evidence: large commits, long fix chains, reverts).

Output: a recommended planning model for this project. Where plans live, the template, the lifecycle (created → approved → executed → closed), and when planning should be skipped because the task is small enough.

### Lens D: Verification and review

Does the process rely on the AI saying "the implementation looks correct"?

Inventory every check: unit, integration, contract, end-to-end and snapshot tests; compilation; type checking; linting; formatting; static analysis; architecture tests; security scanning; database validation; runtime validation; human review; review by a separate AI pass.

Classify each as **Self-verification** (same agent checks its own work), **Independent verification** (a separate tool, test suite or agent), or **Human verification**.

Is each check **enforced** (CI gate, pre-commit hook, required status) or **optional** (the AI has to remember)? Treat optional as roughly equivalent to absent.

Architecture drift: can the process detect "this change works but violates the architecture"? Look for module boundaries, forbidden dependencies, dependency graphs, architecture tests. If absent, specify the cheapest way to add it for this stack (for example dependency-cruiser, eslint boundary rules, import-linter, ArchUnit, or a plain test that asserts import rules).

Review roles: Builder / Reviewer / Architect / Tester / Security reviewer. Is there any evidence that a separate pass catches things the builder missed? Recommend separate roles only where a specific failure class from Phase 3 justifies it. A single independent review pass with a checklist usually beats a five-persona pipeline.

Human attention map: where is human attention spent today, and where should it be? The target is maximum confidence per unit of human attention.

### Lens E: Feedback loops

Trace at least three real instances of: AI makes a mistake → human corrects it → did the system remember?

Which mechanisms exist to convert recurring mistakes into: new tests, new Skills, updated instructions, ADRs, documentation, static analysis, architecture rules, automated checks?

Identify repeated failures that should already have become durable controls.

Draw the loop. Mark where it breaks. State plainly whether the loop is closed.

### Lens F: Tools, environment, autonomy and guardrails

Access matrix, current and recommended:

| Resource | Inspect | Modify | Execute | Requires approval |
| --- | --- | --- | --- | --- |

Resources: source code, tests, build system, database, documentation, git history, CI/CD, logs, APIs, browser/UI, runtime environment, static analysis, security tooling.

Identify missing tools that would materially improve performance (for example: cannot run tests, cannot see logs, cannot query the database, so it guesses).

Autonomy balance. Where is the process assistance (human drives, AI helps) versus agency (AI drives, human approves)? Recommend explicit boundaries for: production changes, database changes, security changes, architecture changes, dependency changes, infrastructure changes, data migrations, destructive operations. Judge whether the AI currently has too much or too little autonomy, with evidence from permission config, hooks and history.

Model independence, briefly: are instructions, Skills, project knowledge, architecture knowledge and evaluation portable across models and vendors? Does the workflow rely on undocumented model behaviour? One paragraph and a short list of fixes.

### Lens G: Evaluation and regression

Is anything measured? Look for: task completion rate, first-pass success rate, iteration count, human intervention count, defect rate, rework rate, test failures, architecture violations, review findings, time to completion, token or context consumption, cost, regression rate, requirement coverage.

Can the owner currently answer "I changed my Skill / process / prompt. Did the AI actually get better?" If not, design the minimal framework: what to log per task (a ten-column log is enough), how to compare before and after, how often to review. Do not recommend generic AI benchmarks.

Golden task suite: should the project have six to ten representative, repeatable tasks with objective success criteria, used to evaluate changes to models, Skills, instructions, architecture, tools, context and workflow? Almost certainly yes. Draft it in Phase 5.

### Lens H: Bottlenecks

Identify the biggest constraints on development velocity. Attribute each to: AI reasoning / context retrieval / human decision-making / review / testing / environment and tooling / architecture / documentation / requirements. Estimate the share of wasted effort each causes. Rank by return on investment if fixed.

---

## Phase 3: Failure forensics

This is where the audit earns its keep. Do not skip it or thin it out.

Method: mine git history, plans, transcripts, PR comments and the issue tracker. Signals: fix chains, reverts, commit messages containing "actually" or "still", repeated edits to the same file, TODOs, commented-out code, duplicated helpers, inconsistent patterns across similar modules, tests added long after the code they cover.

Collect **8 to 15 concrete failure instances**. For each:

| # | What happened | Evidence | Failure type | Primary root cause | Control that would have prevented it | Rough cost |
| --- | --- | --- | --- | --- | --- | --- |

Failure types: misunderstood requirement; wrong abstraction; architecture violation; repeated mistake; unnecessary complexity; failed to test; excessive human intervention; hallucinated project behaviour; failed to use an available Skill; used the wrong Skill; ignored documentation; inconsistent implementation.

Root cause (pick one primary, from Appendix B): model capability; missing context; poor instruction; poor Skill; missing tool; bad task decomposition; ambiguous requirement; missing validation; missing architectural constraint; missing feedback loop; excessive autonomy; insufficient autonomy.

Then aggregate: a **root cause histogram**. This histogram drives the priority order in Phase 5. If the histogram says "missing validation", the recommendations lead with validation, not prompts.

---

## Phase 4: Maturity scorecard

One table. Use the anchored rubric in Appendix A; a score without an anchor is noise.

| Capability | Score (1-10) | Target | Present? | Evidence | Gap to target | Fix (one line) |
| --- | --- | --- | --- | --- | --- | --- |

Capabilities: requirements and context management; architecture guidance; repository context; domain knowledge; Skills and instructions; task decomposition; planning; acceptance criteria; implementation; automated testing; independent verification; code review; architecture validation; security review; documentation maintenance; memory and knowledge retention; error recovery; feedback loops; human oversight; agent autonomy and guardrails; observability; evaluation and regression testing; continuous improvement.

Overall **AI Engineering Process Maturity Score**: weighted, with independent verification, context architecture, feedback loops and evaluation weighted double because they compound. Explain the score in one paragraph.

Compression rule: if more than half the capabilities score 2 or below, replace the table with a short paragraph and a list of what does exist. Spend the saved budget on Phase 5.

Also write `audit-scorecard.yaml`:

```yaml
audit_date: 2026-09-11
mode: full
commit: <hash audited>
overall: 4.2
capabilities:
  independent_verification: { score: 3, target: 7, confidence: high }
  context_architecture:     { score: 5, target: 7, confidence: medium }
  # one entry per capability
root_cause_histogram:
  missing_validation: 6
  missing_context: 4
  # one entry per root cause with count > 0
top_recommendations: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10]
```

This file is what a future Re-audit diffs against. Keep the keys stable.

Name anti-patterns from Appendix D wherever they apply. A named pattern is easier to recognise, easier to act on and easier to track across audits.

---

## Phase 5: Recommend

### 5.1 Target process

Design the recommended lifecycle for this project. Adapt it; do not copy a template. A reference shape:

Requirement → Clarification → Specification → Architecture / ADR → Implementation plan → AI build → Automated verification → Independent review → Architecture check → Human approval → Merge → Knowledge extraction → Evaluation feedback

For every stage:

| Stage | Purpose | Inputs | Outputs | AI responsibility | Human responsibility | Tools | Artefacts | Validation gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Mermaid diagram. Then a delta table against Phase 1: stages added, removed, changed, and stages that move from "remembered" to "enforced".

### 5.2 The ten highest-value changes

Answer: if you were taking over this project and had to make the AI twice as effective at building and maintaining it, what would you change? Rank ten changes by expected benefit. Order must be consistent with the Phase 3 histogram and Phase 2 Lens H ranking; if it is not, explain why.

For each:

- Current problem (with evidence reference)
- Proposed change
- Mechanism: why it should work
- Expected benefit
- Implementation effort (hours or days)
- Risk
- Measurement: metric, baseline, target, timeframe

### 5.3 Roadmap

- **Do immediately**: high impact, low or moderate effort. This week.
- **Do next**: significant benefit, more work. This month.
- **Consider later**: only once the fundamentals are proven.

For each item, note what it depends on. Do not recommend unnecessary complexity.

### 5.4 Stop doing

A list of things to delete or stop: duplicated docs, instructions that do not earn their tokens, Skills that never trigger, rituals nobody follows, process overhead that adds no confidence. If this list is empty, you have not looked hard enough.

### 5.5 Draft artefacts

Write these as real files under `drafts/`. They are proposals, clearly labelled as such, not applied to the project. Deliver at minimum:

1. **Proposed always-on instruction file** (`CLAUDE.md`, `AGENTS.md` or equivalent), restructured to contain only always-on and authoritative content, under 150 lines, linking out to everything else.
2. **Proposed knowledge tree**: directory structure, one line per file, always-on or retrieved marked.
3. **ADR template**, plus one worked ADR retrofitted from a real decision found in the history.
4. **Implementation plan template**, plus one worked example for a real upcoming or recent task.
5. **Golden task suite** (`golden-tasks.md`): six to ten repo-specific tasks. Each has a description, a starting state (commit or branch), objective success criteria, the verification command, and a timebox. Cover a spread such as: add a CRUD feature, change a business rule, add an endpoint, change a data model, add an auth behaviour, fix a known bug, refactor a module, integrate an external service, add a report, change a UI flow. Use the ones that fit this project.
6. **Evaluation log template**: date, task, model, instruction/Skill version, first-pass success, iterations, human interventions, test failures, architecture violations, time, tokens, notes.
7. **Verification gate config**: the actual CI, hook, lint and architecture-test configuration (or diff) for this stack, as far as it can be written without executing it.
8. **"When the AI gets it wrong" runbook**: one page. Classify the failure using Appendix B → pick the control type → put it in the right place → add a golden task if it was expensive.

---

## Phase 6: Self-check

Before assembling the report, verify every line below. Fix anything that fails.

- Every score cites evidence.
- Every recommendation traces to a finding. Every finding traces to evidence or carries an `[inferred]` tag with confidence.
- No recommendation violates the principles in 1.2, especially: no multi-agent, no "more prompts", no "more docs" without a specific failure it fixes.
- The top ten order is consistent with the failure histogram and bottleneck ROI ranking.
- No content is duplicated across sections.
- The stop-doing list is non-empty.
- Every top-ten item has a measurable success test with a baseline.
- The executive summary stands alone and reads in two minutes.
- Present, Absent and Not visible are used correctly throughout.
- The report is within budget (below).

---

## Phase 7: Assemble

### `AI-PROCESS-AUDIT.md`

1. **Executive summary** (one page maximum): maturity score; the three most important findings; the three most important changes; the single biggest bottleneck; what to do on Monday.
2. Current process (map and lifecycle table)
3. Findings by lens, evidence cited
4. Failure forensics and root cause histogram
5. Maturity scorecard
6. Target process
7. Ten highest-value changes
8. Roadmap and stop-doing list
9. Appendices: inventory, analytics, drafts index

Budget: main body under 6,000 words excluding tables, appendices and drafts. If you are over, you are not prioritising.

### `QUESTIONS-FOR-OWNER.md`

Every Not visible item. For each: the question, why it matters, and which finding or recommendation would change depending on the answer.

---

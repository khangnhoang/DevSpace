---
name: code-review
description: "Code review and quality gate for DevSpace: reviewing a checkpoint, commit range, branch, PR, plan or brief, validating corrections, the author self-review method, and writing the brief for a Codex review. Use after implementation, before delivery, for every self-review pass of your own plan or checkpoint, when reviewing another session's work, or when preparing Codex."
---

# Code review

## Use when / do not use when

Use when reviewing a completed checkpoint, correction commit, branch, PR, diff, plan or brief; when deciding whether work is ready for manual QA or delivery; when self-reviewing your own plan or implementation (see Self-review); or when preparing a Codex review.

Do not use to write the plan (`planning`), to commit (`git-pr-workflow`), or for domain rules (`supabase-migration`, `server-actions`, `frontend-design`, `frontend-workflow`; read the ones that match before issuing findings).

Review is read-only. Edit only when the Owner asked for fixes or the workflow allows them. A verdict grants nothing (`docs/agent-loops.md`, Precedence and safety).

## Review workflow

1. **Intent.** Goal, actor, expected behavior, scope, exclusions, acceptance, dependencies, verification, known risks. With no reliable approved scope, say the review is limited.
2. **Range.** Branch, baseline, commits, staged and unstaged changes, untracked files. Do not assume `main` is current. Use `git log --oneline <baseline>..HEAD` and `git diff <baseline>..HEAD`; for one checkpoint `git show --stat HEAD` and `git diff HEAD^..HEAD`.
3. **Read** the plan, the matching skills and the nearby code and docs. Judge against approved behavior, not preference.
4. **Trace** the input through validation, permission, business rule, side effect, persistence, response, UI feedback and docs. Look at what the tests protect.
5. **Apply dimensions** that matter. Read [domain-dimensions.md](references/domain-dimensions.md) for validation, database, frontend, tests, security, performance or git state.
6. **Audit the change set:** required, supporting, unrelated, or unclear ownership. Unrelated changes are removed; unclear ones are investigated. Line count is not a gate.
7. **Verify evidence:** commands, results, later edits that invalidate them, skipped checks, manual QA.
8. **Classify and give a verdict** with the exact next action.

A bug fix, refactor, dead-code removal or dependency change: read [special-cases.md](references/special-cases.md). A report with several findings: read [report-format.md](references/report-format.md).

## Severity and verdict

- `Critical` (blocks): exploitable security issue, data loss or corruption, authorization bypass, broad RLS exposure, broken migration path, destructive behavior, core workflow failure, exposed secret.
- `Required` (blocks): missing or wrong approved behavior, unhandled important path, invalid permission or state transition, missing needed verification, wrong contract owner, scope that must go, documentation that misleads on correctness.
- `Suggestion`, `Nit`, `FYI`: non-blocking. Never disguise a blocker as one of them.

Verdicts: `Approved` (all behavior, evidence, scope and docs complete; no Critical or Required); `Implementation review passed; manual QA pending`; `Changes required`; `Blocked` (missing context, baseline or decision); `Rejected approach`. Approved is not permission to push or merge.

Verification status per claim: `Verified`, `Partially verified`, `Not verified`, `Blocked`. Say what changed, which risk each check covers, what was skipped. Passing tests are evidence, not proof of completeness. Do not invent defects or rubber-stamp.

Plan review: fidelity to the Owner's request and scope; current repo reality; dependencies and assumption evidence; implementable without inventing material decisions; acceptance that can be observed; permissions, rollback and stop routes; migrations marked Codex-gated.

## Self-review

The author's method, for a plan after writing it, for each checkpoint, and over the whole diff at the end. `docs/agent-loops.md` owns when and how often; the block format is there too.

1. **Anchor.** Go back to the request, the plan, scope and exclusions, and open the actual files or diff. Not memory, intent or your own summary. Resolve doubts about which candidate is current before judging it.
2. **Falsify.** List the plausible ways it is wrong: missing requirement, unsupported assumption, wrong owner, unhandled state, scope leakage, stale evidence, a claim stronger than its proof. Test each against the real candidate, with deterministic tools where a machine can decide. Before finishing, check the most plausible reason a reviewer would reject it. Do not invent a defect to complete the step.
3. **Verify.** Apply [test-quality-strategy, Verification stages](../test-quality-strategy/SKILL.md#verification-stages) to this checkpoint or final candidate, using its [command table](../test-quality-strategy/SKILL.md#which-command-for-which-change), and run `git diff --stat`. Do not turn every checkpoint or correction into a final full-suite run. Reuse a passing result only if the last edit cannot affect it and say why; confirm final regression evidence at the final boundary. A failed check is not overridden by narrative.
4. **Proportion.** Scale depth to risk. No extra role, session or artifact just to show a review happened. Self-review does not replace Codex or manual QA.

Repeat until a pass leaves no `Critical` or `Required`.

## Codex

Read [codex-brief.md](references/codex-brief.md) before running Codex, resuming a review or writing a brief.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [domain-dimensions.md](references/domain-dimensions.md) | the review inspects validation, database or concurrency, frontend, tests, security, performance or git state | a compact verdict or a report of given findings |
| [special-cases.md](references/special-cases.md) | the target is a bug fix, refactor, dead-code removal or dependency change | a feature review or a re-review that only checks earlier findings |
| [report-format.md](references/report-format.md) | writing a formal report with several findings | no actionable finding |
| [codex-brief.md](references/codex-brief.md) | preparing or resuming a Codex review | no Codex round |

## Re-review

Review the correction diff; confirm every Critical and Required is resolved by reading the code, not the author's claim; check new regressions; rerun the affected checks; when the reviewed candidate was committed, confirm the correction is a new local commit (an uncommitted candidate is fixed in place, `git-pr-workflow`); update the verdict.

## Checklist

- [ ] scope, exclusions, acceptance and baseline are known
- [ ] matching skills, tests and docs were read; the change was traced through the layers
- [ ] scope creep, missing files and dead code were checked
- [ ] verification is current and manual QA status is explicit
- [ ] findings use the severities; the verdict matches the remaining risk; no remote action is implied

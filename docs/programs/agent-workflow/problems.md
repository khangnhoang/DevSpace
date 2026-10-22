# Problems, risks and follow-ups — agent-workflow

Plan: `plan.md`. Progress: `progress.md`.

## Open

### AW-001: Docs checks are not run by CI

- Status: Deferred (2026-10-22, until the test-infra program).
- Problem: `npm run docs:check` and `npm run docs:check:test` run only when a session runs them. The only check on a pull request is the Vercel deploy, so a docs change that breaks a link or a structure rule can merge.
- Evidence: the repo has no GitHub Actions workflow; the checks exist as npm scripts only.
- Direction: the test-infra program adds a CI job that runs both scripts (FEAT-004 in `future-features.md`).
- Exit condition: a CI job runs `npm run docs:check` and `npm run docs:check:test` on pull requests.

### AW-002: The detail-plan template's progress link resolves by accident

- Status: Accepted (2026-10-22).
- Problem: `.claude/skills/program-docs/references/templates/detail-plan.md` links `[progress.md](progress.md)`, which passes the link check only because the sibling template `progress.md` exists in the same folder. Renaming or moving the progress template breaks the link check on the detail template.
- Evidence: `npm run docs:check-links` passes; removing `references/templates/progress.md` makes the detail-plan link broken.
- Direction: keep the link, because a copied template must keep a working `progress.md` link; move the progress template and the detail template together.
- Exit condition: none needed while both templates stay in the same folder; reopen if one of them moves.

### AW-003: `security-hotfix/problems.md` is exempt from the problems shape

- Status: Deferred (2026-10-22, until a unit reopens the security work).
- Problem: `security-hotfix/problems.md` keeps its P1-P29 table, so `check-structure.mjs` allowlists it for `problems-shape`. It is the only program problems file that is not in the open-entry shape.
- Evidence: the `ALLOWLIST` entries in `scripts/docs/check-structure.mjs`, with their reasons.
- Direction: when a unit reopens security work (H2-2a or H2-2b), reshape the table into open entries and one-line resolved entries, keeping every ID, and remove the allowlist entry. `plan-h2.md` stays on the allowlist because published migrations cite its path.
- Exit condition: the `problems-shape` allowlist entry is removed and `npm run docs:check` passes.

### AW-004: The simulation oracle is readable by the simulated session

- Status: Open (2026-10-22).
- Problem: the expected behavior of the CP5 and CP6 scenarios (`plan.md` sections 4.1 and 4.2) is in the repo, so a simulated session can read the answers; a simulated planner did, and that run was invalid.
- Evidence: the simulated planner read `docs/programs/agent-workflow/plan.md` sections 4.1 and 4.2 during its run.
- Direction: the simulation base branch strips those sections; the oracle lives only in Main's scratchpad.
- Exit condition: a rerun of the planner scenario on a base branch without sections 4.1 and 4.2 gives a valid result.

### AW-005: Skills are not loaded at the point of action

- Status: Open (2026-10-22). A fix is on `exp/aw-005`, pending Codex round 4 and a CP6-I rerun.
- Problem: the simulated implementor committed without loading `git-pr-workflow` and wrote its `Tự review` block without loading `code-review` (no Skill call, no SKILL.md read), although its work was otherwise sound.
- Evidence: the CP6 simulated implementor session, which implemented a mock CP1 and made a local commit with neither skill loaded.
- Direction: `.claude/rules.md` section 2 tells the implementor to load both skills at those points, and the two skill descriptions name the commit and self-review moments; verify with a rerun of the implementor scenario.
- Exit condition: the rerun shows `git-pr-workflow` loaded before the commit and `code-review` loaded before the self-review.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

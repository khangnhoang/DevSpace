# Future features — agent-workflow

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan. These entries come from the skills and rules that were left out only because DevSpace does not have the tooling yet; add each one in the same program or PR that brings the tooling.

## FEAT-002: Test skills for the test-infra program

- Status: Deferred until the test-infra program exists (Vitest/Playwright, an isolated Supabase local with seed data, GitHub Actions).
- Direction: port `test-quality-strategy` and `playwright-cli` from VocaSpace, rewritten for DevSpace. Expand `CLAUDE.md` rule 9 (tests verify observable behavior) into the test skill.
- Target program: infrastructure (test-infra; not created yet).

## FEAT-003: Local database reset and RLS tests in `supabase-migration`

- Status: Deferred until the isolated Supabase local environment and automated RLS tests exist.
- Direction: add `supabase db reset` and the automated RLS tests to the `supabase-migration` skill, replacing the "no local database" workaround it carries today. Remove the temporary rule in `.claude/rules.md` section 4 (implementors run no database) when this lands.
- Target program: infrastructure (test-infra; not created yet).

## FEAT-004: CI step in the workflow and the commands

- Status: Deferred until GitHub Actions exists; today the only check on a PR is the Vercel deploy.
- Direction: add the CI step to `git-pr-workflow`. The GitHub Actions job must also run `npm run docs:check` and `npm run docs:check:test` (agent-workflow D9). Update the commands section of `CLAUDE.md`: the test commands, and real CI instead of Vercel only.
- Target program: infrastructure (test-infra; not created yet).

## FEAT-005: Zod, React Hook Form and shadcn in the skills

- Status: Deferred until the foundation PR (shadcn + Zod + React Hook Form) lands; the Owner wants these adopted incrementally.
- Direction: extend `server-actions` with the Zod parts of VocaSpace `nextjs-server-action-zod` (schemas, FormData, RHF contracts) instead of creating a second skill (D15). Extend `frontend-workflow` with the RHF/shadcn parts, async state and forms (D16). Update `frontend-design` to use shadcn components; it now says "no shadcn, don't add UI libs".
- Target program: none yet (a separate foundation PR, not part of agent-workflow).

## FEAT-006: Replace `window.confirm` with a Dialog

- Status: Deferred until shadcn is applied.
- Direction: replace the `window.confirm` delete confirmations (comments, admin CRUD of courses/chapters/lessons) with a Dialog. Tracked as P21 in `security-hotfix/problems.md`; `frontend-design` already points to this.
- Target program: none yet (the foundation PR).

## FEAT-007: Token budget rule

- Status: Deferred; the rule was cut down to "read deliberately" (`CLAUDE.md` rule 6).
- Direction: revisit a fuller token-budget rule (VocaSpace Core Engineering Rule 6) only if the Owner sets budgets.
- Target program: none yet.

## Closed

- FEAT-008 — Dropped: the `frontend-ui-review` skill; the Owner declined it (D4).
- FEAT-009 — Dropped: the Codex multi-agent skill (`native-multi-agent-workflow`) and the skill governance skill (`maintain-repo-skills`); they exist for Codex-only governance, which DevSpace does not use (D4).

# Problems, risks and follow-ups — agent-workflow

Charter: `README.md`. Progress: `progress.md`.

## Open

### AW-P1: The detail-plan template's progress link resolves by accident

- Status: Accepted (2026-10-22, moved from `agent-workflow` when it closed).
- Problem: `.claude/skills/program-docs/references/templates/detail-plan.md` links `[progress.md](progress.md)`, which passes the link check only because the sibling template `progress.md` exists in the same folder. Renaming or moving the progress template breaks the link check on the detail template.
- Evidence: `npm run docs:check-links` passes; removing `references/templates/progress.md` makes the detail-plan link broken.
- Direction: keep the link, because a copied template must keep a working `progress.md` link; move the progress template and the detail template together.
- Exit condition: none needed while both templates stay in the same folder; reopen if one of them moves.

### AW-P3: CLI-first tooling and repository-controlled delivery

- Status: Fixed locally, awaiting delivery (2026-11-01); [AW-U12 r2](implementation-plans/aw-u12-cli-first/plan.md) CP2 complete on `chore/aw-p3-cli-first`, awaiting Main CP3 validation; no PR or delivery yet.
- Problem: Agents selected MCP before checking available CLI capabilities. At discovery, GitHub CLI was behind the current stable release and Vercel CLI was absent from PATH; adding tools without an explicit delivery boundary also risks bypassing the repository's review, CI and release workflow.
- Evidence: H2-2a hosted catalog reads used the CLI successfully after MCP failures. The repository pins `supabase` to `2.121.0`. Main-supplied CP1 evidence records `gh` upgraded from `2.96.0` to `2.103.3` and previously absent Vercel CLI installed globally at `65.9.0`; paths, installer outcomes and read-only probes are in progress. Vercel project context remains BLOCKED (`link_required: No project is linked in this directory`); installation succeeded. CP2 repository checks and all 13 static cases pass; these are not runtime agent-compliance proof. Existing GitHub/Vercel integration remains the deployment path; permission ownership stays in `AGENTS.md` section 4.
- Direction: Deliver one coherent agent-workflow task: update the machine's GitHub CLI, install Vercel CLI globally, and align shared instructions and their direct consumers with CLI-first selection. Recheck official stable versions before installation; keep machine tooling outside application dependencies and record installation evidence alongside the repository change.
- Tool-selection boundary: Prefer the available CLI for supported operations (`npx supabase`, `gh`, `vercel`); check CLI help before declaring a capability missing. Use MCP only when the CLI lacks the required operation and MCP provides it. CLI errors, authentication failures or permission denials do not establish missing capability or authorize an MCP workaround; preserve role, target and permission boundaries.
- Delivery boundary: Encode the shared permission rule in `AGENTS.md` section 4 and link procedures to it. Tool availability grants no deployment authority. Agents follow the repository's delivery workflow with its existing separate grants; direct deployment, redeployment, promotion or rollback through CLI, MCP, API or UI outside that workflow requires an explicit Owner instruction naming the action and target. An authorized push/merge may trigger the existing automatic deployment, but a workflow description alone grants no push, merge or deployment permission.
- Exit condition: Resolved executable paths and installed versions are verified, permitted read-only CLI checks pass or remain explicitly blocked, and repository instructions consistently cover CLI-first selection and delivery authority. Bounded static decision cases cover supported CLI operations, confirmed CLI capability gaps, CLI/auth failures, inspection without deployment authority, workflow-triggered deployment, and an explicit Owner-directed deployment. Docs checks pass; machine setup evidence is distinguished from Git changes, and static cases are not claimed as live agent-compliance proof.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-P4 — Resolved 2026-11-01: AW-U11 app-only callback/receipt binding delivered after Main validation and independent review; bounded runtime evidence and limits retained in progress (PR 44, `f16ed1e`).

- AW-P2 — Resolved 2026-10-29: the shared link reader ignores multiline code, rejects invalid fence closes and requires matched labels, with regression coverage (PR 41, `b071d62`).
- AW-004 — Resolved 2026-10-22: CP5 and the CP6 planner reran on a base branch without plan sections 4.1 and 4.2, with valid results (`1b8d8e5`).
- AW-005 — Resolved 2026-10-22: the CP6 implementor rerun loaded `git-pr-workflow` before committing and `code-review` before its self-review (`b99315e`).
- AW-001 — Moved 2026-10-22 to [infrastructure](../infrastructure/problems.md), unit U1.
- AW-003 — Moved 2026-10-22 to [security-hotfix](../security-hotfix/problems.md); it waits for H2-2.
- AW-006 — Resolved 2026-10-25: U4 fixed every item and the fresh read-only audit passed (PR 21, `4fa5731`).
- AW-007 — Resolved 2026-10-26: U6 audited every instruction, the Owner decided each item, and section 2 states when Main edits state records (PR 23, `bd19c18`).
- AW-010 — Resolved 2026-10-26: U7 added entry plans, so a delivery program plans a `problems.md` or `future-features.md` entry without revising its master plan (PR 24, `85248b2`).
- AW-009 — Resolved 2026-10-27: `planning` allows a batch of small independent items in one PR and states the plan approval questions, and `.claude/rules.md` section 2 defines an active implementor (PR 26, `723b985`).
- AW-011 — Resolved 2026-10-27: `docs/agent-loops.md` Sizing matches skills to the work after discovery, and the Codex and Sonnet briefs take their skill list from it (PR 28, `7ad7a92`).

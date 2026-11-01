# AW-U12 detail plan — CLI-first tooling and repository-controlled delivery

Revision: r2, 2026-11-01. Owner approval: 2026-11-01; plan commit and implementation authorized. Charter: [agent-workflow](../../README.md). Addresses AW-P3 and the PR #44 AW-P4 docs catch-up.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: DevSpace agents select supported CLI operations before MCP, with current machine tooling and the existing repository delivery and permission boundaries intact.

| ID | Observable result |
| --- | --- |
| AC1 | The machine resolves `gh` and globally installed `vercel` to verified executable paths and official stable versions rechecked immediately before installation. Installation evidence records previous/installed versions, paths, commands and outcomes separately from Git changes. |
| AC2 | When an available CLI supports an authorized operation, an agent uses it first (`gh`, `vercel`, repository-pinned `npx supabase`). It checks installed help, including the CLI's supported API path where relevant, before declaring a capability gap. MCP is selected only for a confirmed CLI capability gap that MCP can fill. |
| AC3 | CLI errors, failed authentication, denied permission, unavailable network or sandbox restrictions remain visible blockers; they do not establish a capability gap or authorize an MCP workaround. Existing role, target and data-access boundaries still apply. |
| AC4 | The shared permission owner explicitly preserves repository-controlled delivery. Direct deployment, redeployment, promotion or rollback outside that workflow, through any tool, needs an explicit Owner instruction naming the action and target. An authorized push/merge may trigger the existing automatic deployment; tool availability and workflow documentation grant no delivery action. |
| AC5 | Read-only GitHub repository metadata and Vercel identity/project-context checks pass or are reported with exact blockers. No login, linking, environment-file access, secret output, hosted-data access or deployment is used to make a check pass. |
| AC6 | Shared instructions and direct delivery-procedure consumers have one owner per rule, pass docs checks and the bounded cases below, and preserve the Claude import graph, app-only AW-U11 binding and existing grants. Static checks are not reported as live agent-compliance proof. |
| AC7 | Owning records reflect AW-P4 delivery in PR #44 at `f16ed1e`, preserve the sampled-runtime limits, and distinguish AW-P3 planning, implementation, machine setup and delivery status. |
| AC8 | When a task adds, removes or replaces a CLI, its owning instructions and affected consumers are synchronized in the same change under `skill-authoring`, Maintaining; the reviewer checks that synchronization. If a tool is removed outside the repository workflow, its next attempted use reports the missing executable and stops; it does not implicitly reinstall the tool or use MCP to bypass the blocker. No automatic detection is promised. |

### 1.2 Scope and non-goals

- In scope: AW-P3 as the Owner-grouped Medium task; update machine GitHub CLI, install Vercel CLI globally, shared CLI-first selection and delivery-boundary wording, direct consumer alignment, verification and installation evidence; AW-P4 docs catch-up from PR #44.
- Non-goals: application dependencies/lockfiles, application code, database/migrations, CI jobs, hosting settings, credentials, environment files, telemetry settings, new skills/checkers, runtime agent patches, production actions and changes to AW-U11 callback behavior; mandatory scans of package declarations/scripts/PATH before each tool selection, a parallel CLI inventory or automatic installation/removal monitoring. The help check before claiming a capability gap remains AC2.
- Size: Medium, one coherent outcome. Machine tooling and several reviewable checkpoints require the planned flow. This documents the existing separate delivery grants without widening them; there is no application authorization, CI or deployment implementation change and no automatic high-risk Codex gate. Re-size if implementation needs one.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Shared selection policy belongs in `AGENTS.md`; delivery authority belongs in its section 4. Procedures link to those owners. | Copies drift or a tool procedure appears to grant authority. |
| G2. Machine setup is Main-owned; one separate implementor owns authorized repository implementation. Main never edits the checkout while that implementor is active. | Installer privileges leak to the worker or concurrent edits enter its checkpoint. |
| G3. Keep global tooling outside `package.json` and `package-lock.json`, retaining the pinned Supabase CLI. | A machine-tool update changes the application's dependency surface. |
| G4. Verify the effective executable path/version, not just installer success; preserve exact failures and previous tooling evidence. | PATH shadowing or partial installation is mistaken for completion. |
| G5. Read-only probes never run bare `vercel`, auto-login/link or deployment commands, and never print tokens. | A capability check mutates hosting state or exposes credentials. |
| G6. Do not infer a missing CLI capability from an execution failure; stop at the existing role, target and permission boundary. | A second interface bypasses the original restriction. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-10-31, recorded in AW-P3): group GitHub CLI update, global Vercel CLI installation, CLI-first selection and the repository delivery restriction as one Medium task; keep the existing GitHub/Vercel deployment path.
- D2 (2026-11-01): the Owner requests AW-P3 plus the lagging AW-P4 docs on a new branch. Branch `chore/aw-p3-cli-first` starts at fetched `main`, `f16ed1e`. This requests implementation; plan approval and commit grants remain separate under `planning` and `AGENTS.md` section 4.
- D3 (2026-11-01): the Owner grants local commits for the approved plan with AW-P4 catch-up and subsequently verified implementation checkpoints/corrections. Commit the plan only after approval; no remote grant is included.
- D4 (2026-11-01): the Owner accepts same-change instruction synchronization when adding/removing/replacing a CLI and visible missing-executable handling at next use after removal outside the workflow. The Owner rejects a mandatory discovery scan before each tool selection. These are revision decisions, not approval of the complete plan.
- D5 (2026-11-01): the Owner approves r2 and directs Main to commit it, then implement the plan; the existing local checkpoint/correction commit grant remains. No push, PR, merge or production action is granted.

## 2. Repository facts

Baseline: `f16ed1e3107e8497f1530c2425d8ee7507186566`, checked 2026-11-01.

- PR [#44](https://github.com/khangnhoang/DevSpace/pull/44) merged AW-U11 at `f16ed1e` on 2026-11-01 Asia/Saigon. AW State/AW-P4 still say awaiting delivery; AC7 corrects that lag without changing the frozen plan or runtime evidence.
- `AGENTS.md` section 4 separates Git/delivery grants, limits implementors to local database operations and prohibits environment-file reads. `git-pr-workflow/references/pr-and-ci.md` already uses `gh` and stops on missing CLI/authentication. AC2–AC5 extend selection clarity without weakening those stops.
- Local `gh --version` is `2.96.0`; `Get-Command gh -All` resolves `C:\Program Files\GitHub CLI\gh.exe`; `winget list --id GitHub.cli --exact` identifies the installation and offers `2.103.3`. `Get-Command vercel -All` finds no executable.
- Official [GitHub CLI release metadata](https://github.com/cli/cli/releases/tag/v2.103.3) reports stable `2.103.3`; official npm registry `npm view vercel dist-tags.latest engines --json` reports `65.9.0`, Node `>= 20`. Installed Node is `v24.11.1`; npm global prefix is `C:\Users\khang\AppData\Roaming\npm`. These are discovery snapshots, not installation results or permanently pinned targets.
- Official [Vercel CLI installation guidance](https://vercel.com/docs/cli) supports global npm installation. Machine setup is outside Git, so a revert cannot undo it (AC1, G3).
- `skill-authoring`, Maintaining already requires updating the owner, finding affected references with `rg` and removing steps for absent tools. AC8 connects CLI lifecycle changes and reviewer verification to that existing procedure; the current docs checks do not detect machine-level tool removal.

## 3. Bounded implementation hypotheses

- Operational repository files: `AGENTS.md` for a generic shared Tool selection rule, the AC8 maintenance trigger linked to `skill-authoring`, Maintaining, and section 4 delivery authority; `.claude/skills/git-pr-workflow/SKILL.md` and `references/pr-and-ci.md` for pointers and any contradictory direct procedure. Tool names are examples, not an exhaustive priority list. Add no second selection-policy or maintenance-procedure owner. Inspect affected references with `rg` when changing the instructions; this is not a mandatory tool-selection scan. Report a needed extra operational file before widening this set.
- Program files: this plan, charter `README.md`, `progress.md` and `problems.md`. Keep State/evidence in progress; no standalone installation-report document or new plan-review log.
- Main can upgrade the identified GitHub CLI through `winget upgrade --id GitHub.cli --exact` with noninteractive agreement options and install the rechecked exact stable Vercel version with `npm install --global vercel@<version>`. Use only official package sources. If the installer requires unavailable elevation or fails, retain the blocker rather than substituting a portable/shadow installation.
- Verify identity/context using installed help before choosing safe flags. GitHub probes can use `gh repo view khangnhoang/DevSpace --json nameWithOwner,url` and existing PR metadata; Vercel probes can use `whoami` and `project inspect --non-interactive` only when supported and verified not to auto-link/login. Missing Vercel authentication/linkage may remain a recorded blocker; never repair it implicitly.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 (Main) | Catch up AW-P4 delivery records, write/self-review this plan; obtain approval and the needed separate grants before operational edits. | PR #44 merged metadata, baseline diff, `npm run docs:check`, `git diff --check`; preserve AW-U11 evidence limits. |
| CP1 (Main) | Update/install machine tools and collect bounded, redacted evidence for the repository implementor. | Recheck official stable releases; installer exit/results; `Get-Command gh,vercel -All`; effective `--version`; installed help; permitted read-only identity/repository/context probes or exact blockers. No repository implementation edits by a worker during machine setup. |
| CP2 (implementor) | Apply CLI-first and delivery-owner wording plus direct consumer pointers, with machine evidence and truthful AW-P3 State. | Full candidate self-review, bounded cases below, `npm run docs:check`, `git diff --check`, protected-file comparison, shared-skill symlink/resource checks. Local checkpoint/correction commits only if granted. |
| CP3 (Main) | Read the implementor report, validate the actual diff and route corrections to that same session; report local completion and remaining limits. | Inspect every changed file and commit; verify AC1–AC8 against actual evidence, including instruction/consumer synchronization for this CLI change. Remote delivery is outside this implementation grant. |

The implementor receives the approved revision and all its authorized repository work in one dispatch. Use the model/effort in `docs/agent-models.md` and a separate observable session under `docs/agent-loops.md`; a CLI session retains its CLI report path. No new app chat or cross-chat messaging is authorized by this plan.

Bounded instruction cases (static judgment checks against the actual candidate):

| Case | Expected decision |
| --- | --- |
| Available CLI exposes an authorized repository/deployment metadata read | Use the supported read-only CLI operation. |
| First-class command lacks a field but a supported CLI API path exposes it | Inspect help and use that CLI path within existing permissions. |
| CLI help confirms no needed operation; MCP provides it | MCP may fill that capability gap within the same role, target and grants. |
| CLI missing, authentication expired, network failure or sandbox/permission denial | Report the exact blocker; no MCP workaround or implicit installation/login. Separately authorized AW-P3 setup remains allowed. |
| Implementor sees a hosted operation supported by CLI/MCP | Existing local-only implementor boundary still blocks it. |
| Main has read-only inspection authority | Inspect only; tool presence grants no deployment. |
| Owner grants a push/merge and existing integration deploys automatically | Follow repository review/CI/delivery gates for that granted action; do not issue an extra deployment command. |
| Owner explicitly names a direct deploy/redeploy/promote/rollback and target | Follow that exact grant and applicable procedure; infer no other action. |
| Owner grants PR creation but no push/merge | Existing separate grants remain intact. |
| Claude/CLI/app sessions load the shared contract | Same CLI selection and delivery limits; AW-U11 applicability remains invocation-specific. |
| A task adds, removes or replaces a CLI | Update its owning instructions and affected consumers in the same change using Maintaining; reviewer verifies the synchronization. The generic priority rule needs no new tool-list entry. |
| A CLI was removed outside the repository workflow | On the next attempted use, report the missing executable; no implicit reinstall or MCP workaround, and no promise of earlier detection. |
| A task selects an already available CLI without adding/removing/replacing it | No new mandatory package/scripts/PATH inventory scan; AC2 help inspection applies before claiming a capability gap. |

No app unit/RLS/E2E, typecheck, lint or build is needed for Markdown-only changes. Run checker tests only if a separately approved checker change becomes necessary. Machine checks prove installed tooling and sampled read access; static cases do not prove future agent compliance. No production mutation is used to test a deny rule.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Installer fails, needs elevation, or PATH still resolves an old executable. | Recheck resolved paths and versions; stop visibly on partial setup, preserve the existing install, and ask for the smallest needed action. |
| Official stable versions change after planning. | Recheck immediately before installation and record the selected version and source, not a stale plan target. |
| Vercel inspection triggers login/linking or resolves another project. | Inspect help first, use explicit noninteractive context checks where supported, stop on missing context/mismatch; no automatic repair. |
| Shared tool-selection rule is read as a permission override. | Co-locate delivery authority in section 4; test denial/error and role-boundary cases, with procedure pointers rather than copies. |
| Updating AW-P4 records overstates runtime reliability. | Preserve bounded idle/busy/fast-receiver evidence and the inconclusive/no-live-send-error limits; no new runtime success claim. |

- Rollout: approve the reviewed plan and needed grants; Main completes machine setup or records blockers; one implementor handles the authorized repository checkpoint; Main validates/corrects; delivery follows separate Owner grants. No hosted step is part of this unit.
- Stop when scope, target, ownership, selected execution mechanism or permission is unclear; a package source is unofficial; an installer/probe requires login/linking or secret access; or operational files outside the bounded set become necessary. A recorded authentication blocker is not an installation success or a passed read check.
- Rollback: revert repository wording in an authorized later change. Machine changes require separate explicit tool reinstall/downgrade/removal actions; Git cannot undo them. No credential, app, database or deployment rollback is involved.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

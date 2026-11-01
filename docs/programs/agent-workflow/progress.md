# Progress — agent-workflow

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AW-U12 r2](implementation-plans/aw-u12-cli-first/plan.md), Owner approved 2026-11-01 with plan commit and implementation grants; AW-P3 plus PR #44 AW-P4 docs catch-up. |
| Current unit / checkpoint | AW-U12 CP0-CP3 complete locally: plan/catch-up bc8603d, implementation 43534cc and Main validation cad910a. Owner completed Vercel linking; Main's subsequent read-only project/deployment verification passed. Remote delivery authorized. |
| Status | Fixed locally, awaiting delivery: Main validated the actual candidate and full implementor report with 0 Critical and 0 Required. AW-U11 delivered in PR #44, AW-P4 resolved with bounded evidence limits. |
| Completed evidence | Main performed CP1: official stable checks immediately before installation confirmed gh v2.103.3 (not prerelease), Vercel 65.9.0 and Node >=20 (installed v24.11.1); both installers exited 0, effective paths/versions verified. GitHub repository/account reads and Vercel identity read passed; the initial project-inspect blocker was later cleared by Owner linking and the subsequent read-only probes below. Separate CLI implementor 01a19429-e597-7e52-a3b0-a72b34059c25 used gpt-6.1-sol/medium, verified from turn context, and committed 43534cc. Main read the full report and five-file diff, checked all 13 static cases against AC1-AC8, independently reran npm run docs:check (zero violations), git diff f16ed1e..HEAD --check, protected-path comparisons against bc8603d, and the existing skill symlink/resource checks (3 identical files, 12 identical relative-link targets, index mode 120000). No unrelated finding. Static cases are not live agent-compliance proof. |
| Supplied CP1 GitHub CLI setup | official stable gh v2.103.3 rechecked via gh api repos/cli/cli/releases/latest; winget upgrade --id GitHub.cli --exact --version 2.103.3 --source winget --silent --accept-package-agreements --accept-source-agreements --disable-interactivity verified the official MSI hash and installed successfully (exit 0); effective gh 2.103.3 (2026-10-26), formerly 2.96.0, remains C:\Program Files\GitHub CLI\gh.exe (Get-Command gh -All); external to Git, a revert cannot undo installation |
| Supplied CP1 Vercel CLI setup | npm view vercel dist-tags.latest engines --json rechecked 65.9.0/Node >=20; npm install --global vercel@65.9.0 --registry=https://registry.npmjs.org exited 0, added 296 packages; formerly absent, Get-Command vercel -All resolves C:\Users\khang\AppData\Roaming\npm\vercel.ps1, vercel.cmd and extensionless wrapper, effective vercel.cmd --version 65.9.0; PowerShell uses vercel.cmd; external to Git, a revert cannot undo installation |
| CP1 and subsequent read probes | gh repo view khangnhoang/DevSpace --json nameWithOwner,url and gh api --method GET user --jq login exited 0 with the expected repo/URL and khangnhoang; vercel.cmd whoami --non-interactive --json exited 0 (khangdz2005k, khang-devs-projects). Initial project inspect exited 1 with link_required. After Owner linking, vercel.cmd project inspect --non-interactive --json exited 0 and confirmed project devspace (prj_ERibXV9VdOBLY7PcgeG6ATYjDeXO), owner khang-devs-projects; vercel.cmd inspect https://devspace-lms.vercel.app --scope khang-devs-projects --non-interactive --json exited 0 and confirmed target production, readyState READY and the expected alias. These are metadata reads, not application QA. |
| Accepted deviations | None. AW-U11's frozen plan and operational binding remain unchanged. |
| Blockers / Owner decisions | No remaining local or Vercel project-context blocker. Initial sandbox network failures remain historical failed attempts, not capability gaps. Main now follows CI and merge gates; no CI-fix push or direct production/database mutation is granted. |
| Next action | Main pushes the reviewed branch, creates the PR and records terminal CI results in its body; merge only when required checks and all other merge gates pass. |
| Current authority | Owner approved r2 and local plan/checkpoint/correction commits, then granted push, PR creation/CI-result reporting and merge conditional on green CI. No branch deletion, CI-fix push, direct deployment or database action is granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 CP1: `CLAUDE.md`, `.claude/rules.md`, `docs/agent-loops.md`, `.gitignore` and tracked `launch.json` (`062fdd2`).
- 2026-10-22 CP2: the eight project skills with references and templates (`ad0912a`).
- 2026-10-22 Rule added: ask the Owner when the auto-mode classifier denies an action (`89478e0`).
- 2026-10-22 CP3: docs structure and link checks with tests and npm scripts (`404f483`).
- 2026-10-22 CP3 follow-ups: skills aligned with the checks and the future-features template cleaned (`f42698d`).
- 2026-10-22 CP4: docs index, roadmap ADR, backlog, program docs and the English security-hotfix docs (`797b856`).
- 2026-10-22 Main review round 1 corrections: CI and Codex rules pointed to their owners, classifier rule covers both roles, PR reference form unified (`d1203c8`).
- 2026-10-22 Codex round 1 corrections: skills `ad7474d`, rules and loops `4bf2ae4`, docs checker `5476649` (`2ceb405`).
- 2026-10-22 Codex round 2 corrections: docs checker declaration scan `3e15869`, skills GET callback and target size `8760b92` (`95866a2`).
- 2026-10-22 AW-005 fix on exp/aw-005: the implementor loads git-pr-workflow before committing and code-review for self-review; AW-004 and AW-005 recorded (`b99315e`).
- 2026-10-22 AW-005 fix adopted into chore/agent-workflow after the CP6-I rerun loaded both skills (`b99315e`).
- 2026-10-22 Temporary rule: implementors run no database; FEAT-003 removes it (`505f103`).
- 2026-10-22 Owner rule: Main may run read-only hosted catalog queries without asking (`157672d`).
- 2026-10-22 Current authority aligned with the hosted-query rule (`bcc0406`).
- 2026-10-22 Owner rule: Main edits program state records without a review round (`f040387`).
- 2026-10-22 CP5 passed AC8 and CP6 passed AC9; AW-004 and AW-005 resolved (`3ab2604`).
- 2026-10-22 Merged to `main` and the AC2 memory mapping applied (PR 6, `50a3075`).
- 2026-10-22 Program closed; open entries moved to `infrastructure`, `security-hotfix` and the backlog (`7969be9`).
- 2026-10-23 U2 merged: the CI result in the PR body, the PR template, hosted apply with `db push`, the migration and handoff rules (PR 13, `38d431b`).
- 2026-10-23 Reopened as an evergreen program: charter, U1 moved, U2 and U3 plans, AW-002 and FEAT-007 back from the backlog, FEAT-010 and FEAT-011 (`abfa4b3`).
- 2026-10-23 U3 merged (PR 14, `8606dcf`).
- 2026-10-25 U4 plan r5 approved after the Codex plan gate; AW-006 Direction records U4 D3 and D4 (`ca6a4a2`).
- 2026-10-25 U4 plan r6: the implementor updates State in its checkpoint commits (D8); AW-007 recorded (`05fdcb8`).
- 2026-10-25 U4 CP1: handoff template, section 7 one-task and docs-lag rules, Resources row (`ccef754`).
- 2026-10-25 U4 CP2: `migration new` allowed for implementors in section 4; permission and CI facts have one owner each (`af8b792`).
- 2026-10-25 U4 CP3: change-to-suite table and the manual-QA seed rule in `test-quality-strategy`, linked from the verify steps (`a01e34d`).
- 2026-10-25 U4 CP4: `npm run dev` runs on the local stack with a tested environment map, `devspace-dev` uses `127.0.0.1:3000`, manual QA docs run on the seeded local stack (`435fd3d`).
- 2026-10-25 U4 CP5: `playwright-cli` block covers the references, README current, stale pointers fixed (`1f13cef`).
- 2026-10-25 U4 Main review corrections: section 4 says implementors never open or update a PR or merge, `readLocalStack` messages are neutral, `migration new` wording (`7a1e240`).
- 2026-10-25 U4 Codex round 1: the dev env test asserts the Gmail placeholder literals (`af9bce9`).
- 2026-10-25 U4 Owner QA: `npm run dev` hides the typeless-package warning of its launcher import (`aab40ee`).
- 2026-10-25 U4 AC12 audit corrections: suite selection, CI facts and permission statements point to their owners (`efae00b`).
- 2026-10-25 U4 AC12 audit round 2: permission statements outside section 4 reduced to pointers, CI-fix scope moved into section 4 (`a3a2ce8`).
- 2026-10-25 U4 AC12 audit round 3: CLAUDE.md rule 10 names section 4 as the owner of git, remote and database permissions without restating them (`f6c1ea2`).
- 2026-10-25 U4 CP6: backlog entries BL-007, FEAT-015 and FEAT-016, AC12 audit PASS (`30b27dc`).
- 2026-10-25 U4 merged; AW-006 and BL-007 resolved (PR 21, `4fa5731`).
- 2026-10-26 U5 plan r7 approved after the Codex plan gate; PR 21 docs catch-up (`7d954cc`).
- 2026-10-26 U5 CP1: `skill-authoring` with templates and the audit reference, section 8 trimmed to the permission rules, pointers fixed (`af720ff`).
- 2026-10-26 U5 CP2: skill-shape check with tests chained into `docs:check` and `docs:check:test`, the `playwright-cli` allowlist entry, the charter invariant names `skill-authoring` (`059b57a`).
- 2026-10-26 U5 Main review corrections: flow lists and maps rejected in skill frontmatter, rules linked by section name (`17fa0ea`).
- 2026-10-26 U5 Codex diff round 1: the skill check reads links with the `check-links` reader, the related-rules list holds only labels and owners, AW-008 recorded (`fa24371`).
- 2026-10-26 U5 description rewrite after a misread AC8 result (`863c83c`).
- 2026-10-26 U5 AC8 passed both cases; the `skill-authoring` description is back to the Codex-reviewed text (`db51b04`).
- 2026-10-26 U5 merged (PR 22, `c9741e7`).
- 2026-10-26 U6 plan r2 approved after the Codex plan gate; PR 22 docs catch-up (`c84ffa1`).
- 2026-10-26 U6 CP1: Codex running rules, handoff contents and code-comment rule moved to their owners, test command lines trimmed, Main and implementor editing rule reworded (`20003ba`).
- 2026-10-26 U6 CP2: restatements in skills and references replaced by pointers to their owners, language rule linked, `--no-verify` and attribution lines removed, wording fixes (`c263587`).
- 2026-10-26 U6 CP3 Main review corrections: the password-and-token prohibition restored in manual UI validation, sentence split in `test-quality-strategy` (`2df8637`).
- 2026-10-26 U6 Codex diff round 1 corrections: the new-program starting rule added to `program-docs`, test coverage pointer names the sections that hold it, a stale template reference fixed (`b3ed33a`).
- 2026-10-26 U6 Main review of the round 1 correction: the single-unit rule in `program-docs` keeps both meanings (`bb7fd53`).
- 2026-10-26 U6 merged; AW-007 resolved (PR 23, `bd19c18`).
- 2026-10-26 U7 plan r1 approved; PR 23 docs catch-up; AW-009, AW-010 and infrastructure FEAT-017 recorded (`4d7fec5`).
- 2026-10-26 U7 CP1: the structure check accepts entry plans of delivery programs and looks their IDs up in the program's own problems.md and future-features.md, with tests (`f2844c8`).
- 2026-10-26 U7 CP2: `program-docs` states the entry-plan rule, the detail-plan and master-plan templates name entry plans (`9bda2d0`).
- 2026-10-26 U7 CP3 Main review passed; State before the PR (`8c4806c`).
- 2026-10-26 U7 merged; AW-010 resolved (PR 24, `85248b2`); PR 24 docs catch-up (`e9b6915`).
- 2026-10-27 AW-009 as a small task: chat plan r2 approved; the Owner items recorded in AW-009, AW-011 recorded, infrastructure PR 25 docs catch-up (`18d5fd3`).
- 2026-10-27 AW-009 merged; AW-009 resolved (PR 26, `723b985`).
- 2026-10-27 AW-011 as a small task: chat plan r1 approved; the Owner decision recorded in AW-011, PR 26 and PR 27 docs catch-up (`c32e0b4`).
- 2026-10-27 AW-011 rule: `docs/agent-loops.md` Sizing matches skills to the work after discovery; the Codex and Sonnet briefs and the `skill-authoring` related-rules list point to it (`4fbfdaa`).
- 2026-10-27 AW-011 Codex diff review passed; State before the PR (`03790d3`).
- 2026-10-27 AW-011 merged; AW-011 resolved (PR 28, `7ad7a92`).
- 2026-10-29 U8 r3 approved after self-review: shared rules plan, bidirectional baseline traceability and full instruction audit; local plan commit and `gpt-6.1-sol` / `medium` implementation handoff authorized (`f04f546`).
- 2026-10-29 U8 r4 records the Owner's explicit local implementation/checkpoint/correction commit grant; no remote or hosted grant (`ef74df6`).

- 2026-10-29 U8 CP1: shared AGENTS contract, Claude-only bindings, lifecycle handoff and active policy pointers; bidirectional traceability and symlink verification (`6d3605f`).

- 2026-10-29 U8 CP2: bounded import-contract validator, AGENTS link coverage and negative fixtures; checker commands integrated (`9c17f1c`).

- 2026-10-29 U8 CP3 corrections: restore Claude-binding routing, include AGENTS in citation discovery and remove the duplicated browser restriction; docs and symlink checks passed (`6a50a3c`).

- 2026-10-29 U8 CP3: full instruction audit and bidirectional baseline/scenario review passed; static and filesystem evidence complete, runtime compliance unverified; local implementation complete, nothing pushed (`12d24b8`).
- 2026-10-29 Recorded FEAT-021 to FEAT-024 as four testing follow-up PRs; instruction policy belongs to agent-workflow and helper, coverage and CI work stays in backlog because infrastructure is closed. Owner authorized branch delivery conditional on green CI and a subsequent local merge into AF U1 (`a9dae2a`).
- 2026-10-29 U8 delivered: shared skills/rules and the four testing follow-ups merged; static instruction evidence retained, runtime compliance remains unverified (PR 37, 8599de8).
- 2026-10-29 FEAT-021 rediscovery at main after U1 delivery identifies manual-first routing and stale coverage/readiness guidance; U9 r1 self-reviewed and Owner-approved, with a plan-first/local-checkpoint commit grant (`1dc3cc5`).
- 2026-10-29 U9 CP1: contract-based test selection, current helper limits and explicit safe-data prerequisites; legacy cleanup enforcement remains FEAT-022 (`d97f5fc`).
- 2026-10-29 U9 CP2: direct consumers route selection to the policy, with residual manual QA and corrected U1 coverage/readiness facts (`8ac2b66`).
- 2026-10-29 U9 CP3: bidirectional baseline review, 12 static decision cases, skill resources/links and docs checks passed; FEAT-021 fixed locally, awaiting Main review and delivery (`4aeca89`).
- 2026-10-29 Main review PASS on CP1–CP3: 72/72 checker tests and 7-skill resource/link verification confirmed; Owner accepted local completion, FEAT-021 awaits delivery and FEAT-025 records separate session/exploration guidance (`3f38986`).
- 2026-10-29 U9 accepted complete and FEAT-021 closed for delivery; Owner grants push, PR/CI reporting and merge conditional on green CI; no next initiative started (PR 39).
- 2026-10-29 U10 r2 approved after self-review PASS; plan commit and separate `gpt-6.1-sol`/medium implementation session with local checkpoint/correction commits authorized (`d63ce93`).

- 2026-10-29 U9 merge catch-up: automated-first testing policy delivered, future runtime agent compliance remains unverified (PR 39, `50c649f`).

- 2026-10-29 AW-U10 CP1: program-scoped naming activated with strict validation, mapped open records, bounded historical exceptions and preserved completed plans; automated checks and meaning/symlink comparisons passed, awaiting Main review (`8e7a5a5`).

- 2026-10-29 AW-U10 CP1 correction: H4–H6 declarations cannot evade naming/ownership checks, and retained legacy U rows reserve canonical U ownership while legacy F/P numbers stay independent; 84 docs tests and static/history checks passed (`6802012`).
- 2026-10-29 AW-U10 delivered after Main re-review passed and all six required CI jobs plus Vercel passed on `6802012` (PR 40, `18261cd`).
- 2026-10-29 AW-F4: shared execution boundaries distinguish exploration subagents from independent sessions and preserve role, permission and Claude bindings (`3d70b9e`).
- 2026-10-29 AW-P2: one shared link reader ignores multiline code and invalid fence closes and requires matched labels; regression tests and docs/static checks pass, and the obsolete snapshot baseline is removed (`53504b2`).
- 2026-10-29 AW-F4 Owner follow-up: one role-to-model/effort table for Codex and Claude; Main keeps the chat selection, consumers reference the table, and execution/permission boundaries remain unchanged (`f250157`).
- 2026-10-29 AW-F4 and AW-P2 delivered together; shared execution/model guidance and corrected docs link parsing merged (PR 41, `b071d62`).

- 2026-11-01 AW-U11 r2 approved with plan commit and implementation grants; independent CLI plan review passed, while runtime rollout remained CP0-gated (`ff488a8`).
- 2026-11-01 Bounded CP0 idle/fast-receiver evidence recorded, execution resumed and prior PR #42/#43 delivery records caught up; CP1 chat scope remained pending (`602bb90`).
- 2026-11-01 AW-U11 CP1: app-only handoff binding and conditional discovery implemented; six applicability and ten additional protocol cases checked statically, protected paths unchanged, docs checks and self-review passed; Main validation and independent CP2 pending (`f5976da`).
- 2026-11-01 AW-U11 CP2: Main validated f5976da and independent read-only reviewer passed with no findings; local implementation complete, with runtime limits retained and delivery then ungranted (`db05890`).

- 2026-11-01 AW-U11 delivered and AW-P4 resolved: app-only binding merged after Main validation and independent CP2 PASS on f5976da (reviewer 01a193fe-72f7-7e23-93b6-8352658598c2); PR #44 catch-up preserves sampled evidence and its limits (PR 44, `f16ed1e`).
- 2026-11-01 AW-U11 retained feasibility evidence: P4-BUSY-01 correlated result/ACK, P4-TIMEOUT-01 retained report with missing ACK, P4-EDGE-01 dispatch-stop sample, P4-IDLE-02 confirmed idle wake-up and fast receiver completion (dispatch 01a1932f-0e5b-7b52-acfa-61e04aa5d87d, probe 01a19335-83a5-7422-a033-72d2ac7a3c2e, Main handling 01a19336-1ba8-7862-93da-c59e4d5e49b5); P4-IDLE-01 inconclusive, no live transport-send-error sample, no durable-delivery or future-compliance proof (PR 44, `f16ed1e`).
- 2026-11-01 AW-U12 r2 approved after self-review; Owner grants plan/catch-up commit, machine setup and implementation with local checkpoint/correction commits; no remote or production grant (`bc8603d`).
- 2026-11-01 AW-U12 CP2: generic CLI-first policy and section 4 delivery authority with direct consumer pointers; Main-supplied machine evidence retained, 13 static cases and repository/docs/protected-path/symlink checks passed; AW-P3 fixed locally awaiting Main CP3 validation and delivery, no runtime-compliance claim (`43534cc`).
- 2026-11-01 AW-U12 CP3: Main validated 43534cc and the complete implementor report against r2; docs/whitespace/protected-path checks and 3-file/12-link skill comparisons passed, 0 Critical and 0 Required; Vercel project-context read then remained explicitly blocked, local implementation complete and nothing pushed (`cad910a`).
- 2026-11-01 Owner linked Vercel; subsequent project and production-deployment metadata reads passed with the expected devspace/khang-devs-projects target and READY alias. Owner granted push, PR/CI reporting and merge conditional on green CI; no direct deployment or database action (this commit).

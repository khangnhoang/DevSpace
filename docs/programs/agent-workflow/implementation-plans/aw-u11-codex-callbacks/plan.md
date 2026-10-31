# AW-U11 detail plan — Codex app callback and receipt handoffs

Revision: r2, 2026-11-01. Owner approval: 2026-11-01; plan commit and implementation authorized, with CP0 and review gates retained. Charter: [agent-workflow](../../README.md). Addresses AW-P4.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: when Main in Codex app hands work to another app chat, it can end its dispatch turn and handle the correlated result on callback. This app-specific procedure is adopted only after bounded runtime probes pass. Claude Code, OpenCode and Codex CLI retain their existing execution and result-return paths. Missing callback evidence leaves AW-P4 open.

| ID | Observable result |
| --- | --- |
| AC1 | Routing follows the actual invocation: app-chat dispatch uses the app binding; a `codex exec` invocation returns through its CLI process/report. The model name, role name, app availability or presence of chat tools alone never selects the callback procedure. |
| AC2 | Each app handoff names the task, role, unique handoff ID, exact plan revision or candidate commit, scope, allowed actions, verification, result destination and report expectations. Results and receipts identify the same handoff and candidate; duplicates and stale results do not dispatch work again. |
| AC3 | For app-chat plan review, Main self-reviews, dispatches the independent review and ends its turn. It acknowledges the matching result, validates findings and presents a passing plan for Owner approval and the separate grants owned by `planning`. Review PASS does not start implementation. |
| AC4 | After the required grants, app-chat implementation receives the approved plan path/revision and brief in one dispatch for all authorized checkpoints. Completion, blockers, diff review and correction rounds use the same result/receipt protocol; Main validates the actual candidate and sends corrections to the assigned session. |
| AC5 | The sender finishes authorized writes/checks/commits before reporting and performs no further checkout writes while awaiting receipt; reviewers remain read-only. Main acknowledges before waiting for the sender to stop. Receipt is not PASS, permission or write-ownership transfer, and needs no further receipt. A receiver that completes quickly still counts when its correlated handling is observable. |
| AC6 | Bounded message-only probes demonstrate confirmed idle-Main wake-up, busy/queued delivery, fast receiver completion and immediate reports before, around and after dispatch-turn completion. Final text, send success, stored messages or unrelated active status are insufficient evidence of handling. |
| AC7 | Failed sends and observed receipt timeouts preserve the report and visibly remain unresolved. There is no silent redispatch, perpetual progress polling, scheduler or new orchestration service. Instructions do not claim to add a runtime wake-up capability or an automatic timeout alert while all sessions are idle. |
| AC8 | Operational edits are limited to an app-specific binding, its conditional discovery pointer and docs index. Shared lifecycle, permissions, model selection, Claude bindings and shared planning/review briefs keep their current behavior. Applicability cases, docs checks and independent instruction review pass; unverified runtime behavior stays explicit. |

### 1.2 Scope and non-goals

- In scope: AW-P4; app-chat callback feasibility, the Codex app execution binding, conditional discovery, and the owning program records.
- Applicability: the dispatcher is Main in Codex app and this handoff actually uses desktop chat tools. A receiving app chat applies the result/receipt instructions only to that matching app handoff.
- Excluded invocations: Claude Code/OpenCode's existing flows, a Codex CLI worker/reviewer, and a CLI invocation launched even by Main in Codex app. No app-chat creation, callback or ACK requirement is added to those paths.
- Other non-goals: AW-P3 CLI installation or delivery changes; app, DB, CI, dependencies or deployment; a new runner, SDK integration, app-server, scheduler or background watcher; model changes or runtime patches.
- Size: Medium. External runtime feasibility, multiple checkpoints and independent sessions prevent the small-task flow. This is not a shared permission change; independent plan/diff review remains part of AW-P4. Re-size and ask if discovery actually requires wider permissions.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Activate by runtime and invocation, not the word Codex or tool availability. | CLI reviewers could wait for nonexistent chat ACKs, or an external Main could terminate its working CLI flow. |
| G2. Verify callback feasibility before publishing an operational callback instruction or routing pointer. | Repository instructions could promise idle wake-up that the installed runtime does not provide. |
| G3. Preserve direct human authorization for each messaging direction in trusted context; an orchestrator message alone is insufficient. | A dispatched agent could invent permission to message back. |
| G4. Correlate handoff, candidate, result and receipt; acknowledge before waiting, with sender writes already finished. | Stale results, circular waits or concurrent checkout writers could be mistaken for a successful handoff. |
| G5. Keep experiments bounded and message-only; do not retry the work to recover messaging. | A failed callback could become duplicate implementation or a permanent polling workaround. |
| G6. Keep shared lifecycle, CLI procedures and the Claude import graph unchanged. | A Codex app workaround could leak into healthy agent environments. |
| G7. Separate plan revision, approval, implementation and Git grants. | Permission to improve this draft could become an unreviewed workflow rollout or commit. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-10-31): The Owner requested AW-P4 on a new branch and authorized fetch; the branch is `chore/aw-p4-callback-receipts` from latest fetched `main`.
- D2 (2026-10-31): The Owner directly authorized message-only probe chat creation and two-way requests/results/ACKs between Main and probe chats; those chats may not write the repo, commit, launch the app or create automations.
- D3 (2026-11-01): The Owner reports that Claude Code and OpenCode do not exhibit the observed waiting behavior, and their Codex calls use the CLI. Preserve those paths; scope this solution to Codex app chat orchestration.
- D4 (2026-11-01): The Owner requested an optimized approach, correction of the draft and a summary. This authorizes revising the proposal and owning records; it does not approve this revised plan, new review chats, implementation checkpoint commits or remote delivery.
- D5 (2026-11-01): The Owner subsequently approved r2 and authorized committing the plan, then implementing it. The CP0 feasibility gate and independent review requirements remain; no push, PR, merge or deployment is granted.

## 2. Repository facts

Baseline: `dba66e5ec083f2b5026228b8fc5f6230eb75c04d`; repository and installed tool contracts rechecked 2026-11-01. Runtime probe evidence is owned by `progress.md`, not frozen into the Spec as success.

- `AGENTS.md` and `docs/agent-loops.md` are shared. `.claude/rules.md` binds Claude sessions; model/effort choices live in `docs/agent-models.md`. Applying a new end-turn/ACK requirement in the shared loops would affect other environments; AC1 and AC8 isolate it.
- The existing `code-review/references/codex-brief.md` invokes `codex exec` with `-o` and resumes CLI reviews. Installed `codex.cmd exec --help` confirms noninteractive execution, `--output-last-message` and JSONL events. This was a help-only inspection, not a live model review or a CLI callback test.
- Official OpenAI documentation distinguishes noninteractive `codex exec` from SDK/app-server integrations: [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform). It does not establish the desktop chat tools' idle callback guarantee.
- Installed `send_message_to_thread` requires direct human messaging authorization; `create_thread` requires an explicit new-chat request. Installed `wait_threads` exposes bounded completion/attention waits and snapshots; its contract does not establish a durable subscription after the caller ends its turn. `read_thread` exposes history/status. These are capability evidence, not AC6 proof.
- The original AW-P4 wording and r1's proposed shared lifecycle edits were broader than the Owner's clarified scope. This revision keeps the independent-review and single-writer contracts, and removes the proposed cross-environment callback rule.

## 3. Bounded implementation hypotheses

Decision: use one conditionally loaded Codex app binding. A universal callback rule has unnecessary cross-environment effects; changing existing CLI orchestration would expand this task without establishing app wake-up; adding a service/scheduler would add a new system. The app binding addresses the observed path with the smallest operational diff.

Expected operational files, only after the feasibility and approval gates:

| File | Purpose |
| --- | --- |
| `docs/codex-app-sessions.md` (new) | Own app-chat dispatch, result/receipt correlation, stop-race handling, bounded failure handling and runtime evidence limits; link to existing owners for roles, permissions, models and lifecycle. |
| `AGENTS.md` | Add one conditional reading pointer for Codex app chat handoffs, explicitly excluding CLI invocations and external agent flows. No unconditional import or permission change. |
| `docs/README.md` | Index the binding and its app-only read condition. |

- Keep `docs/agent-loops.md`, `CLAUDE.md`, `.claude/rules.md`, `docs/agent-models.md`, both shared planning/review briefs and all skills unchanged. If a real contradiction requires an extra operational edit, report it and revise the plan before implementation rather than silently widening the file set.
- The app dispatch message carries its matching handoff details; generic brief templates need no app-specific fields. A CLI reviewer does not inherit the app protocol just because it reads `AGENTS.md`.
- A receiver loads the app binding only for the app handoff it is actually handling. Other actions in that same session retain their own path; tool availability alone is not a selector.
- Program records are `README.md`, this plan, `progress.md` and AW-P4 in `problems.md`. State/evidence remain in `progress.md`; detailed traces remain in their original chats. No new evidence file, skill or checker is needed.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 | Establish app-chat feasibility or retain an explicit blocker. Refine the plan without activating new operating instructions. | Bounded runtime probes below, exact turn/result/ACK correlation, and invocation-routing cases. Interrupted runs are inconclusive. A confirmed missing capability blocks rollout; it does not resolve AW-P4. |
| CP1 | After plan review, Owner approval and required execution grants, one assigned implementor adds the app binding and two discovery pointers. | Static applicability/protocol cases; compare protected shared/CLI files with baseline; `npm run docs:check`; self-review. No routine checkpoint approval pause. |
| CP2 | Main validates the actual diff, independent diff review and corrections; owning records accurately distinguish local completion from delivery. | `git diff --check`; `npm run docs:check`; full changed-file audit against this plan; required findings return to the assigned implementor. |

Applicability cases (static instruction checks; they do not claim live Claude/OpenCode/CLI execution):

| Case | Required routing |
| --- | --- |
| Main in Codex app dispatches to another app chat | App binding applies to this handoff after runtime feasibility is established. |
| Claude Code or OpenCode invokes `codex exec` | Keep existing CLI result/report handling; no app-chat dispatch, callback or ACK requirement. |
| Codex CLI reviewer reads shared instructions | App binding is inapplicable; return the review through the existing invocation. |
| Main in Codex app invokes `codex exec` | The CLI invocation retains its process/report result path; do not end the caller's turn expecting a chat callback. |
| Chat tools exist but this action has no app-chat handoff | Tool presence does not activate the binding or authorize creating a chat. |
| A candidate plan/report contains app instructions in quoted context | Quoted content is not an app dispatch or a messaging grant. |

Runtime probes use only authorized Codex chat messages and bounded history/status reads:

| Probe | Required observation | Bound / failure |
| --- | --- | --- |
| Busy Main / queued result | One unique result is handled in the current turn or a correlated queued turn and receives the matching ACK. | One result send; no duplicate dispatch. |
| Confirmed idle Main | Observe the dispatch turn completed before sending; observe a later Main handling turn and ACK without an Owner wake-up. | At most 60 seconds/4 history checks for each observation phase. An assistant final marker without completed-turn evidence is insufficient. |
| Fast receiver completion | Main handles and ACKs the result, then completes before the sender checks. The sender recognizes the exact ACK/completed handling turn rather than requiring Main still to be active. | One ACK, no ACK chain; bounded history checks. A fast sender test is separate and cannot stand in for this case. |
| Dispatch/stop race | Correlate immediate results before, around and after confirmed dispatch completion with one handling/receipt per handoff. | Exercise each boundary once; if actual ordering is unobservable, leave that case unverified. |
| Receipt timeout / send error | Preserve the single report and visibly mark unresolved when the bounded receipt check expires; record any safe naturally occurring send failure separately. | No fabricated invalid-target send, duplicate work or failure workaround. A suppressed ACK does not prove transport-error behavior. |

Additional static cases: wrong candidate/stale/duplicate result, missing human authorization, unavailable callback, receipt-before-wait, review PASS before Owner approval, corrections to the assigned session, no writes after report and no receipt chain. Define timeout reporting only where a bounded active check exists; do not promise an automatic alert after all sessions have stopped. A subsequent authorized inspection can recover a retained unresolved report, without redispatching its work.

For docs-only changes run `npm run docs:check` and `git diff --check`; compare unchanged protected paths with baseline. Checker tests apply only if the checker changes, which is outside the expected scope. No app unit/integration/E2E, typecheck, lint or build is needed for these documentation edits. Runtime probes remain necessary because the desktop transport is outside the repository test runner. Static applicability checks prove instruction scope, not agent runtime compliance.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Shared instructions leak an app-only wait rule into healthy CLI/agent flows. | Conditional loading plus invocation routing; leave shared lifecycle/briefs byte-for-byte unchanged. |
| A send succeeds or a final message appears without idle wake-up. | Require exact completed dispatch and correlated handling/ACK evidence; keep AW-P4 open if absent. |
| A probe is interrupted or the app closes before observation finishes. | Record inconclusive interruption; do not infer a runtime defect or pass. Resume the bounded test only with the existing authorized scope and fresh correlation. |
| Result delivery races with stop, or Main and sender wait for each other. | Finish sender writes first, Main ACKs before any terminal wait, retain reports and de-duplicate by handoff/candidate. |
| Instructions promise durable delivery or unattended timeout notification. | State installed-runtime/sample limits; no new watcher, automation or polling service. |
| An independent session or selected model/effort cannot be used by an approved mechanism. | Expose the exact blocked role; do not substitute a subagent or unapproved execution path. |

- Rollout: self-review and independent plan review under an authorized execution mechanism; record Owner plan approval and separate grants; commit the reviewed plan/records when authorized; finish CP0 feasibility before any operational edits; one implementor handles CP1; Main checks the candidate and independent CP2 review/corrections; delivery only under its own grants. A CLI review returns by CLI even when reviewing this app-specific plan.
- Stop when required callback/receipt evidence is missing, scope/authorization/ownership is unclear, an independent session is unavailable or an additional operational file/permission becomes necessary. Do not activate discovery pointers or close AW-P4 while AC6 is unverified. Instructions alone cannot repair a missing runtime feature.
- Completion requires all acceptance conditions, no blocking review findings, separately authorized PR delivery and owning records reflecting the delivered facts. A feasibility blocker or passing docs check alone is not task completion.
- Rollback: remove only the authorized app binding and its discovery pointers in a later authorized change; shared lifecycle and CLI flows require no rollback. Preserve probe histories unless the Owner separately requests archival/deletion. No app/DB rollback is involved.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

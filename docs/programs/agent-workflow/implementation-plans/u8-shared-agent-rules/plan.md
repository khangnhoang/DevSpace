# U8 detail plan — Shared agent rules with Claude-specific bindings

Revision: r3, 2026-10-29. Owner approval: 2026-10-29 after successful self-review. Charter: [agent-workflow](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: agents working on DevSpace have one shared repository contract in
`AGENTS.md`; Claude loads it alongside its own bindings and the shared lifecycle.
Existing permissions, review gates and task behavior retain their meaning.

Size: Medium, moderate instruction-regression risk. This is a behavior-preserving
reorganization, not a product authorization change. Self-review is required on
the plan and implementation; no additional Codex plan or diff gate is required
for U8 unless the Owner requests it or the scope becomes Large/high-risk.

| ID | Observable result |
| --- | --- |
| AC1 | An agent reading root `AGENTS.md` finds the project context, commands, code map, core engineering rules, language policy, role responsibilities, permission boundaries, finding triage and information-ownership principles without needing Claude-specific instructions to discover the shared contract. It is explicitly directed to read `docs/agent-loops.md` before planning or acting and to load each applicable skill. |
| AC2 | Claude's root `CLAUDE.md` directly imports `AGENTS.md`, `docs/agent-loops.md` and `.claude/rules.md` exactly once each. It holds only the Claude entrypoint and any indispensable Claude-specific guidance, not copies of shared policy. The other three files do not import back into it or import one another. Their ordinary source references do not imply automatic import in another agent. |
| AC3 | `.claude/rules.md` retains the current Claude orchestration bindings: Main is Opus, the implementor is `claude-sonnet-5-5` at effort `high`, and the existing Codex review workflow remains read-only. Session APIs, effort checks, `SendMessage`, `AskUserQuestion`, auto-mode denial handling, Claude UI mechanics and Claude memory storage bindings remain explicitly scoped to that environment. |
| AC4 | For each baseline permission or gate, the equivalent restriction is present under its new owner: separate action grants, implementor restrictions, hosted prepare/apply and metadata/data boundaries, secret and credential limits, review triggers and exceptions, single-writer ownership and the active-implementor definition. No agent becomes Main, implementor or reviewer merely because of its product name, and no generic Codex implementation workflow or standing grant is introduced. |
| AC5 | `docs/agent-loops.md` preserves its existing sections, sizing conditions, Loop 0–3 order, stop conditions, self-review order and CI-fix limit. Shared references point to their new owners; Sonnet and `AskUserQuestion` mandates are replaced with role/action wording. A small Handoff section carries the existing provider-neutral handoff lifecycle from rules section 7; Claude memory paths and write/delete mechanics stay in `.claude/rules.md`. No new lifecycle stage or approval gate is added. |
| AC6 | Active skills, references, templates and program guidance point to the correct policy owner. Shared procedures express outcomes independently of Claude APIs; concrete Claude calls move into the corresponding bindings in `.claude/rules.md`. Asking the Owner through a question box is shared behavior: use the agent's supported native question interface, preserving the common language, decision and grant-separation rules. Only the exact `AskUserQuestion` name/call belongs to Claude bindings; a different native tool name is not a missing capability. A genuinely missing tool or approved execution method is reported as unavailable; no replacement server launch, model dispatch or permission workaround is implied. The Codex brief distinguishes discoverable skill metadata from the full skill content its reviewer must read. |
| AC7 | `.claude/skills/` remains canonical and all 12 existing `.agents/skills/<name>` directory symlinks are unchanged. After each affected skill edit, its link exists, targets the original directory, and all resources remain readable through the symlink; relative references within and outside the skill resolve from both paths. The documented vendored example-link exception remains explicit. |
| AC8 | `npm run docs:check` includes root `AGENTS.md` in relative-link checks and checks the bounded instruction-entrypoint contract of AC2. It fails on a missing required import, a missing import target, an unexpected or repeated import, a back/nested import or a cycle. Import-looking examples in inline code or fenced code are not treated as imports. This validates the repository's flat import contract, not every syntax supported by Claude. |
| AC9 | Fixture tests exercise valid entrypoints and each AC8 failure, plus a broken relative link originating in `AGENTS.md`. No new link baseline exemption is added. `npm run docs:check` and `npm run docs:check:test` pass; checker code also passes `npm run lint` with 0 problems and `npx tsc --noEmit`. |
| AC10 | A bidirectional instruction traceability table accounts for every baseline-root instruction and each affected skill passage, and every instruction in the resulting root documents and affected skill passages. Old-to-new detects omissions and weakened conditions, obligations, exceptions, prohibitions and stop rules. New-to-old identifies each resulting instruction's baseline source or explicit Owner decision in this plan; merges/splits retain all source links. No unaccounted instruction, unjustified deletion, weakened rule or unauthorized new obligation is accepted. Report baseline `file:line`, resulting `file:line`, baseline source or decision ID, change kind and equivalence verdict. Demonstrate preserved boundaries with the scenarios below. Static checks, filesystem access and any actual agent-loading observation are reported separately; no runtime enforcement is inferred from structure. |
| AC11 | `skill-authoring/references/audit.md` includes `AGENTS.md` and uses the updated ownership map. After restructuring, CP3 performs a full read-only instruction audit of all four root instruction documents, every project `SKILL.md` and every project reference, with only the DevSpace block audited for vendored `playwright-cli`. Classify each instruction using the existing six audit categories and report `file:line`, category, owner and reason, with finding severity separate from category. Judge placement against the new ownership map and preserved meaning against the frozen baseline. The audit is not limited to the diff; finish only with no unresolved Critical or Required findings. |

### 1.2 Scope and non-goals

- In scope: root `AGENTS.md`, `CLAUDE.md`, existing `.claude/rules.md`, minimal
  `docs/agent-loops.md` edits, affected canonical skills/references/templates,
  bounded docs validators and tests, npm docs-check script wiring, and the
  `agent-workflow` charter and state records required to describe this initiative.
- Active pointers in `README.md` and `docs/README.md` may change only where the
  new ownership makes them incorrect. Update an active deferred entry's pointer
  only if its meaning stays unchanged; frozen implementation plans stay historical.
- Non-goals: application code, CI workflow/job changes, production, database,
  dependencies, user or managed agent configuration, memory files, model routing
  changes, new agent infrastructure, broad instruction rewriting or shortening,
  and unrelated AW-008 link-parser defects.
- The 12-symlink implementation and shared-skill authoring workflow are the
  existing baseline; do not redo them or reverse their canonical direction.
- The Owner authorized the clarified plan after successful self-review, its local
  commit, and a new local `gpt-6.1-sol` / `medium` implementation chat. This is a
  task-specific execution assignment, not a change to standing Claude role/model
  bindings. Implementation commits, push, PR, merge and production actions remain
  ungranted. The new chat implements and verifies CP1–CP3 without committing.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Use the baseline role and permission contract throughout implementation; edited instruction files do not grant authority to the current session. | A rule migration could authorize its own wider actions. |
| G2. Preserve the restrictions and exceptions together, including standing read-only hosted metadata permission and the prohibition on user-data reads without approval. | Moving only the prohibition or only the exception changes behavior. |
| G3. Keep shared policy in `AGENTS.md`, lifecycle in loops, Claude bindings in `.claude/rules.md`, and task procedures in skills. Update the ownership table in `skill-authoring` accordingly. | Copies diverge or later maintenance puts shared policy back under Claude. |
| G4. Keep `.claude/rules.md` at its existing path and all current skill symlinks at their current targets. Do not introduce a `.claude/rules/` directory. | An unnecessary path migration expands scope and breaks consumers. |
| G5. Read and compare with the frozen baseline, not with an implementor's summary. Existing historical plans and vendored upstream bodies remain unchanged. | The meaning check could approve omissions or rewrite provenance. |
| G6. No agent runtime, model call, browser launch, stack reset, hosted request or personal-memory mutation is needed to implement or statically verify U8. Report unavailable runtime evidence rather than inventing it. | Validation gains unintended external side effects or overstates evidence. |
| G7. Stop for a new Owner decision if preservation requires changing a role assignment, permission, review trigger/exception, model binding or lifecycle condition; re-size before continuing. | A Medium reorganization silently becomes a policy change. |
| G8. Compare against immutable baseline `94f5f260d1a4ef7a01ac5f4628aa9fe7aa9dd228` using `git show <baseline>:<path>` and `git diff <baseline> -- <paths>`, in both directions. New instruction text needs a baseline source or an explicit Owner decision; the implementor's preference or a passing checker is not a source. | A one-way move audit misses invented instructions or silently softened wording. |

### 1.4 Owner decisions that bind this unit

1. (2026-10-29) Establish shared `AGENTS.md`, a Claude entrypoint importing shared
   guidance, Claude-only rules, and common lifecycle guidance; prioritize keeping
   the current loops structure and behavior.
2. (2026-10-29) Plan the behavior-preserving implementation as Medium inside the
   evergreen `agent-workflow` program, with self-review and no automatic Codex gate.
3. (2026-10-29, superseded by decision 7) The initial request covered writing and
   self-reviewing the plan only; subsequent authority is explicitly recorded below.
4. (2026-10-29, existing skill decisions) `.claude/skills/` remains canonical;
   `.agents/skills/` contains per-skill directory symlinks. Skill updates verify
   link existence, target and resource access, without requiring an agent/model run.
5. (2026-10-29) Add the full repository instruction audit to CP3. Native question
   boxes are available across agents; separate this shared interaction from the
   Claude-specific `AskUserQuestion` tool name and invocation.
6. (2026-10-29) Require two-way comparison with the pre-reorganization commit to
   detect lost, weakened or invented instructions; every change has traceable
   provenance, and new requirements must map to an explicit Owner decision.
7. (2026-10-29) After the clarification passes self-review, approve and locally
   commit the plan, then open a new local implementation chat using exactly
   `gpt-6.1-sol` with reasoning effort `medium`. This overrides the default
   Sonnet dispatch for this task only. No implementation-commit or remote grant
   is implied by the instruction to commit the plan.

## 2. Repository facts

Baseline: `94f5f260d1a4ef7a01ac5f4628aa9fe7aa9dd228`, checked 2026-10-29.

- `AGENTS.md` is absent. `CLAUDE.md` has project context, commands, code map and
  13 core rules, and imports only `.claude/rules.md` and `docs/agent-loops.md`.
  The imported files have no direct imports — justifies AC1–AC2.
- `.claude/rules.md` sections 1–8 mix shared language, roles, permissions, triage,
  memory ownership and skill governance with Opus/Sonnet/session-specific steps.
  Section 3 defines the read-only Codex review workflow — justifies AC3–AC4.
- `docs/agent-loops.md` already owns sizing, Loop 0–3 and self-review, but cites
  `.claude/rules.md` for shared authority, `CLAUDE.md` rule 6, Sonnet and
  `AskUserQuestion` — justifies minimal AC5 changes.
- Shared references include mandatory Claude browser APIs in
  `frontend-workflow/references/manual-ui-validation.md`, `AskUserQuestion` in
  `planning/references/master-plan-workflow.md`, Claude memory storage in the
  handoff template, and the obsolete no-skills assertion in
  `code-review/references/codex-brief.md`. Twenty skill/reference files contain
  66 textual occurrences of `.claude/rules.md`; some will remain valid because
  they refer to Claude bindings — justifies AC6 and selective pointer updates.
- Commits `2765f37` and `94f5f26` established 12 relative skill symlinks and their
  authoring rules. They are local history on `chore/share-claude-skills`; U8
  depends on that content, not on remote delivery — justifies AC7.
- `scripts/docs/check-links.mjs` scans `docs/`, `.claude/`, `CLAUDE.md` and
  `README.md`, not root `AGENTS.md`. It checks Markdown links, not `@import`.
  `check-skills.mjs` intentionally validates canonical `.claude/skills` —
  justifies AC8–AC9; changing its canonical directory is unnecessary.
- `docs:check` and `docs:check:test` already exist in `package.json`; checker
  tests use Node's test runner and isolated fixture directories. The baseline
  docs check passes with one allowlisted vendored example link — justifies AC9.
- The charter has U1–U7 and no open initiative; U8 is the next free ID. AW-008
  is an unrelated open parser issue; backlog discovery found no matching entry
  to move into this initiative — justifies the initiative and scope boundary.

## 3. Bounded implementation hypotheses

These are likely edits, not permission to widen the Spec.

| Baseline source | Proposed owner and preservation boundary |
| --- | --- |
| `CLAUDE.md` context, Commands, Code map, Core engineering rules | `AGENTS.md`; preserve all 13 rule meanings and existing command restrictions. Keep detailed procedures in their skills. |
| `.claude/rules.md` section 1 | Shared owner/language/reporting rules to `AGENTS.md`; Claude question/UI bindings remain in `.claude/rules.md`. |
| Sections 2–3 | Shared responsibilities, single-writer limits and review applicability to `AGENTS.md`; actual Opus/Sonnet/Codex mapping and session APIs remain in Claude rules. Codex's assigned reviewer remains read-only. |
| Section 4 | Shared grants, standing permissions and prohibitions to `AGENTS.md`; Claude classifier-specific handling stays in Claude rules, with the same denial and retry limits. |
| Sections 5–6 | Shared scope triage, native question-box use and decision timing/format constraints to `AGENTS.md`; the concrete `AskUserQuestion` binding and Claude-specific wrap-up UI behavior remain in Claude rules. |
| Section 7 | Information placement and non-authoritative memory principles to `AGENTS.md`; existing common handoff timing, one-task and completion/catch-up conditions to a small loops subsection; Claude memory location, index and storage operations stay in Claude rules. No new memory permission is created. |
| Section 8 | Skill permission boundaries to `AGENTS.md`; authoring procedures stay in `skill-authoring`, including the source/symlink rules. |
| Loops and active skill pointers | Update owners and neutral role/action wording. The handoff template refers to the common lifecycle and scopes its Claude storage instructions. Keep command-level review procedures in `code-review/references/codex-brief.md`, explicitly conditional on that review mode. |
| `skill-authoring` ownership map and `references/audit.md` | Update the shared/Claude/workflow owner map and audit scope together in CP1. Preserve the six classification categories, evidence requirements, vendored boundary and read-only nature of an audit pass. |

- A small `scripts/docs/check-instructions.mjs` plus a Node fixture test is a
  likely home for AC2/AC8 checks; extending an existing checker is acceptable if
  it stays bounded and does not fold in AW-008. Match existing CLI exit/error
  conventions; wire the validator into `docs:check` and its fixture tests into
  `docs:check:test`.
- Extend `check-links.mjs` and its tests to include root `AGENTS.md`. Do not add
  dependencies or change the parser's unrelated behavior.
- At approval, update `progress.md` with U8 and its authority; checkpoints update
  State under the existing single-writer and commit-grant rules. Implementation
  and State edits stay uncommitted until the Owner grants implementation commits.

## 4. Checkpoints

Run sequentially in the Owner-requested implementation chat after approval. Each checkpoint
must leave coherent policy ownership and pass its verification before proceeding.
Local checkpoint commits occur only under an explicit implementation-commit grant.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Shared entrypoint, Claude bindings and all affected active references migrate together (AC1–AC7), including the ownership map and audit scope required by AC11. Complete the source-to-destination meaning comparison before considering this checkpoint done; do not leave pointers to removed policy sections. | `npm run docs:check`; `git diff --check`; read old/new policy side by side against AC4/G2; inspect import targets directly; verify affected skill symlinks, readable resources and relative references from both paths. |
| CP2 | Bounded instruction/import validation and `AGENTS.md` link coverage are integrated, with meaningful fixture tests (AC8–AC9). Update checker-owning guidance only when the tooling is actually present. | `npm run docs:check:test`; `npm run docs:check`; `npm run lint`; `npx tsc --noEmit`; `git diff --check`. Fixtures demonstrate a valid flat graph, each rejected graph and a broken link from `AGENTS.md`. |
| CP3 | Whole-diff self-review, final meaning/scenario verification and the full read-only instruction audit pass (AC10–AC11); program records reflect the actual authority and remaining limits. Report the audit table, corrections, final verdict and candidate, then stop for the Owner. | Apply the updated `skill-authoring/references/audit.md` to the complete instruction scope, not only changed passages. Check all six categories and run the scenarios below. Return in-scope corrections to CP1/CP2, then rerun the full audit against the final candidate until no Critical/Required findings remain. Repeat affected docs checks after edits; verify scope and unchanged skill-link targets. Reuse CP2 lint/typecheck only if no code/config changed. |

Each audit pass edits nothing. Apply authorized corrections between passes and
re-review the corrected candidate; report unrelated or decision-blocked findings
without silently widening scope. Preserve explicit vendored/allowlist exceptions.
This is the author's repository audit, not an additional Codex dispatch, model
evaluation or independent-review gate.

The AC10 traceability table covers both directions: baseline instruction to its
resulting location(s), and resulting instruction to baseline source(s) or Owner
decision(s). Classify moves, rewordings, splits, merges and approved additions;
check the actor, scope, prerequisite, obligation strength, exception and stop
condition, not only matching words. An apparent deletion through deduplication
must identify the surviving equivalent rule. Mechanical import/checker rules
introduced by AC2/AC8/AC9 are approved additions and must cite those acceptance
criteria in the Owner-approved r3 plan (decision 7); do not mislabel them as
historical instructions.
Run the two-way comparison in CP1 and repeat it over the final candidate in CP3.

Scenario review is a source-grounded manual comparison of the written contracts,
not an automated behavioral test. For each case, cite the resulting rule and
confirm the same boundary:

| Case | Required preserved result |
| --- | --- |
| Owner requests a read-only audit/review | Analysis is allowed; no file or Git mutation is inferred. The assigned Codex reviewer stays read-only. |
| An implementor is running a turn on the approved plan | Main does not edit the checkout; corrections go to that implementor. An idle session alone does not trigger the active-writer prohibition. |
| No implementor is active and Main changes State | Existing direct-State exception and docs check remain; commit remains a separate grant. |
| Agent has a commit grant only | No push, PR update, merge or hosted action follows from it. |
| Review passes or CI finishes | Neither result grants delivery authority. Existing review triggers/exceptions and two-round CI-fix limit remain. |
| Main needs hosted metadata or user data | Standing catalog/metadata permission remains; user rows and writes still need their own grants. No actual request is made for this scenario. |
| Claude classifier denies an action | Same exact-action approval, no workaround and retry limit; no other agent is instructed to call Claude's API. |
| A shared skill calls for a tool the agent lacks | The agent reports the unavailable method and pending check; no silent substitute or new authority. |
| An agent has a native question box with a different tool name | It uses its supported question interface for the same Owner decision; it does not require Claude's `AskUserQuestion` API or treat the different name as a blocker. |
| A task's PR is merged but its docs still lag | The existing one-task handoff and catch-up lifecycle remain; no permission to mutate another agent's memory is inferred. |

## 5. Risks, rollout and rollback

| Risk | Mitigation and first checkpoint |
| --- | --- |
| A moved sentence widens authority or loses an exception | Complete the baseline mapping and scenario checks in CP1; unresolved semantic changes stop under G7. |
| A generic role accidentally claims Main's privileges | Preserve explicit assignment and the Claude mapping; no name-based default for other agents (CP1). |
| Missing references or double-loaded shared policy | Flat direct imports, active-pointer review and `AGENTS.md` read directive (CP1); negative fixtures and link coverage (CP2). |
| Import parsing expands into a general Markdown parser rewrite | Validate only the declared repository contract; AW-008 remains excluded (CP2). |
| Passing checks are presented as actual runtime compliance | Separate structure, filesystem access and runtime observations; runtime invocation is not a completion requirement or authorized side effect (CP3). |

- Rollout: local instruction/doc/checker changes only; no hosted or deployment
  steps. This branch contains the prerequisite local skill commits; integrate
  them coherently if the Owner later requests delivery. Push/PR/merge are not
  part of the current grant. The approved plan commit and explicitly requested
  implementation chat are allowed; implementation commits are not yet allowed.
- Browser/data QA: not applicable; application behavior and data are unchanged.
  Actual agent instruction-loading or model-compliance experiments are not run
  by this plan and must not be claimed as verified.
- Stop when the baseline changes under shared files, another writer becomes
  active, checks fail outside U8, or a role/permission/tool choice would change
  existing behavior. Report the exact unresolved decision; re-size and add the
  required gates if the work becomes Large/high-risk.
- Rollback: before delivery, make focused corrections with the baseline as the
  comparison source; no unrequested reset or discard. After delivery, any
  authorized correction/revert restores imports, policy owners and pointers
  together and keeps program State truthful. No database rollback is involved.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

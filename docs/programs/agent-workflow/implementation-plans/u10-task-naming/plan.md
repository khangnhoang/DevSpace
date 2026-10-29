# U10 detail plan — Program-scoped work identifiers

Revision: r2, 2026-10-29 (Owner correction: allocate numbers locally by owner and kind; renumber migrated open features/problems and always allocate a destination-local number on transfer). Owner approval: r2 approved 2026-10-29 after plan self-review PASS. Charter: [agent-workflow](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a work identifier states its owning program, kind and number; a short title states the work. Current records adopt the new convention without rewriting completed history. The docs checker rejects new legacy declarations, including ones immediately marked closed.

Size: Medium, one agent-workflow initiative and one PR on `chore/task-naming`. Planned flow: Main plans and reviews; one assigned implementor implements after Owner approval and an implementation grant. No automatic Codex gate: no product, authorization, database, dependency, CI or deployment behavior changes. Re-size if discovery crosses those boundaries.

| ID | Observable result |
| --- | --- |
| AC1 | A reader finds each program's unique code in the Programs table of `docs/README.md`: AW = agent-workflow, INF = infrastructure, DM = dependency-maintenance, AF = app-foundation, SH = security-hotfix. BL is reserved for the backlog, which remains outside that table and is not a program. Duplicate, missing, malformed or reserved program codes fail validation. |
| AC2 | A new identifier uses `<CODE>-<KIND><n>`: F for feature, P for problem, U for unit or evergreen initiative. Codes contain 2–4 uppercase ASCII letters; n is a positive decimal integer without leading zeroes. Feature/problem headings use a colon and short title, for example `AW-F4: Agent sessions` or `AW-P2: Markdown links`. A unit/initiative table row starts with its full ID followed by its title/link; detail-plan H1s follow AC3. Titles and slugs remain English; no machine-enforced word count is introduced. |
| AC3 | A new nested detail plan uses the lowercase identifier and a nonempty kebab-case slug, for example `implementation-plans/aw-u10-task-naming/plan.md`, titled `# AW-U10 detail plan — Program-scoped work identifiers`. Unit/initiative table, title, folder and program code agree. Existing delivery entry-plan ownership and evergreen no-entry-plan rules remain enforced. A new single-unit delivery root stays at `plan.md`, uses `<CODE>-U1` in its detail-plan title and needs no new Units table. |
| AC4 | Numbers are local to each owner and kind: F, P and U have independent sequences, including BL-F and BL-P for backlog. For this one-time migration, assign still-open standard features/problems consecutive numbers starting at 1 within each owning home and kind, ordered by ascending old numeric value; section 1.6 fixes the exact mapping. Old FEAT numbers and legacy problem numbers do not reserve values in the new F/P namespaces. Deferred and Accepted entries in Open remain open. After activation, allocate one greater than the highest number already issued in that owner/kind, including canonical closed entries, moved pointers and mapping sources; never fill gaps or recycle an issued new-format number. |
| AC5 | App-foundation's unstarted U2–U6 rows and current references become AF-U2–AF-U6, without changing scope, order, gates or permissions. All 19 pre-existing nested detail-plan paths remain unchanged as completed history. This initiative is open: its draft U10 identity and path migrate to AW-U10 in the activation checkpoint; it receives no permanent legacy exception. |
| AC6 | Every retained old declaration has a finite baseline exception keyed by exact file, identifier, declaration role and retained form, with a reason. A new old-style ID, reuse in another file/role, a reopened legacy entry or a new row added to the security-hotfix legacy table fails. Exceptions waive only naming checks; unrelated shape, field, ownership and link checks continue to apply. Existing security-hotfix shape exceptions retain their original scope and do not suppress the new naming checks. |
| AC7 | An explicit old-to-new mapping preserves references to migrated entries. Each mapping records the old file/ID and destination file/ID; destinations exist, duplicate/ambiguous sources and cycles fail, and transitive historical transfers resolve to one canonical owner. A mapping is not permission to declare the old ID again. Existing closed `Moved to` lines stay unchanged and resolve through this mapping. Historical detail plans, milestones, ADRs and published SQL remain unchanged; their old identifiers can still be traced. |
| AC8 | When a task later changes owner, allocate the next number in the destination owner's sequence for the same kind, regardless of its old number or whether that number is free there. For example, BL-F20 becomes DM-F3 when DM has issued F1 and F2; DM's F sequence and BL's F sequence remain independent. The old home keeps a `Moved to` pointer and the mapping records the transfer. A pointer or alias does not count as another owned entry or satisfy a delivery entry plan's own-program requirement. The checker rejects duplicate canonical ownership by the full `(code, kind, number)` key across open and closed declarations and rejects kind/file mismatches. Two owned DM-F3 declarations fail; DM-F3 with DM-P3 or AW-F3 is valid. |
| AC9 | Current instructions and State use canonical identifiers; historical quotations/citations retain their old identifiers and are not rewritten by global replacement. A new ADR records the convention and explicitly supersedes only conflicting naming/ID-stability clauses of existing documentation. `program-docs` and its templates own the executable shape; other procedural consumers link to that owner or update only their affected examples/references. |
| AC10 | Before inventory is frozen, DM-001 and DM-002 close with PR #32 (`1c99b77`), retaining their historical IDs, and dependency-maintenance State reflects that delivery. This records the historical removal and trial-install policy, not a new claim that all six packages remain absent after later feature work. U9's PR #39 merge (`50c649f`) is recorded in agent-workflow State/milestones. No other entry is closed merely because its wording looks complete. |
| AC11 | All mandatory verification in section 1.5 passes after activation, including positive and negative CLI fixtures, exact historical-path/content comparisons and the real repository checks. Reports distinguish mechanical validation from meaning review and future agent compliance, which remains unverified. |

Number allocation in AC4/AC8 is the creation/transfer procedure, not a new sequence-continuity validator. Per D7, the checker adds no gap warning or failure: an otherwise valid inventory containing DM-F2 and DM-F4 is not rejected solely because DM-F3 is absent. The next allocation uses the highest issued value plus 1, never fills that gap. Deterministic mapping/allocation assertions verify the procedure; duplicate ownership remains a blocking validation error.

### 1.2 Scope and non-goals

- In scope: a program-code column and reserved backlog code; the naming/lifecycle contract, templates and additive ADR; structure validator and its tests; bounded historical exceptions and transfer mappings; open-entry migration, unstarted AF units, affected current references and necessary state catch-up.
- Non-goals: implementing FEAT-025 or fixing AW-008; opening another program; changing product code, database/schema, known-bug test identities, runtime packages, CI workflow, deployment or permission/role/session rules; renaming program folders; rewriting closed plans, closed entries, historical milestones, existing ADRs or published migrations.
- Security-hotfix: preserve the existing P1–P31/AW-003 table and both plan paths/identities as a precisely inventoried historical exception, including currently unresolved rows. Do not perform the AW-003 reshape or H2-2 work. New work recorded there follows SH-F/SH-P/SH-U conventions; additions cannot inherit the legacy table exemption.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Build the exact inventory from baseline files and merged Git evidence before allocating IDs. Preserve each entry's status, scope, acceptance, dependencies and authority. | Delivered work is migrated as open, or an ID change silently changes the work. |
| G2. Never grandfather by lifecycle alone, a directory prefix, a whole file's future content or an arbitrary creation date. | A newly added legacy declaration passes by claiming to be old or closed. |
| G3. Validate naming separately from existing broad shape allowlists; check aliases as references, not declarations. | The security exception or a transfer mapping becomes an admission path for new invalid work. |
| G4. Activate contract, validator, templates, migrated records and bootstrap plan rename together. No temporary permissive fallback or unchecked transition mode. | A checkpoint instructs agents to write names its checker rejects, or accepts both grammars indefinitely. |
| G5. Preserve published-migration-cited paths and completed detail plans byte for byte. Update live references surgically. | External citations break or frozen historical evidence is rewritten. |
| G6. Stop on a collision in the fixed migration inventory, ambiguous ownership/status, a missing historical target, concurrent writers or an acceptance change; resolve from evidence or return to Main/Owner. Future transfers always use AC8's destination-local allocation rule. | Bulk replacement guesses business state or overwrites another session. |
| G7. Use permissions from `AGENTS.md` section 4; plan approval, implementation and all Git/remote actions remain separate grants. | Documentation work becomes an inferred execution or delivery grant. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-10-29): identifiers expose program, kind and task number, followed by a short action/title; use program codes rather than ambiguous initial letters.
- D2 (2026-10-29): migrate still-open work, retain closed history and accept only bounded pre-existing legacy exceptions; new work must use the new grammar.
- D3 (2026-10-29): do this naming initiative first on a new branch; FEAT-025 and AW-008 remain a later paired task. Their identifier/reference migration here does not implement them.
- D4 (2026-10-29, native decision): security-hotfix keeps its exact inventoried legacy IDs/plans; new entries must use the new grammar; the table reshape still waits for H2-2.
- D5 (2026-10-29, native decision): a task moving to another program receives an identifier for the new owner, with an explicit old-to-new mapping and pointer.
- D6 (2026-10-29, Owner correction): numbering is local to each owner and kind. Migrated open features/problems are renumbered locally; transfers always receive the destination's next number rather than retaining a free source number. Unit/initiative numbering continues the program's existing sequence; closed history stays unchanged.
- D7 (2026-10-29, native decision): do not add sequence-gap checking in this initiative. Block duplicate identifiers and invalid mappings; creation/transfer follows highest issued number plus 1. Do not add a gap warning, continuity failure or historical allocation ledger for this purpose.
- Proposed details for approval with this plan: the code registry, no zero-padding, single-unit root naming and deterministic migration ordering/table below. These are Spec proposals, not previously granted implementation authority.

### 1.5 Verification allocation

| Guarantee | Layer and assertion | Location/command and prerequisites |
| --- | --- | --- |
| Program codes and new declarations | Node CLI fixtures accept valid codes/F/P/U IDs and reject missing/duplicate/unknown codes, BL as a program, wrong kind/owner, zero/leading-zero IDs and empty titles. Duplicate DM-F3 ownership fails both open/open and open/closed cases; DM-F3 plus DM-P3 or AW-F3 passes. A valid historical transfer pointer plus one owned destination does not create duplicate ownership. | Extend `scripts/docs/check-structure.test.mjs`; `npm run docs:check:test`; no Docker or hosted access. |
| Plan identity and ownership | Fixtures cover delivery/evergreen/root and entry plans, matching folder/title/table, mismatches, uppercase/slugless folders, absent own entry and a foreign/moved entry that must not satisfy ownership. | Same existing CLI fixture harness; retain the unrelated shape assertions while changing naming cases. |
| Closed-history boundary | Valid exact legacy declarations pass; a new legacy declaration under Closed, one copied to another file/role, a reopened old item, and an extra legacy security row fail. Other invalid fields still fail on an exempt item. | Same test file, extending the existing security-hotfix allowlist cases; real inventory tested, no generic blanket fixture exemption. |
| Alias/transfer integrity and allocation | Fixtures cover direct and chained transfers, retained historical pointers, missing destinations, cycles, ambiguous source mapping and duplicate ownership. Allocation cases prove BL-F20 transfers to DM-F3 after DM-F1/F2 even when DM-F20 is free; F/P/owner sequences are independent, issued closed/moved new-format IDs reserve numbers, gaps are not filled, and legacy DM-001/002 do not reserve DM-P1/P2. An otherwise valid DM-F2/DM-F4 fixture passes without a gap diagnostic; subsequent allocation is F5. Aliases cannot authorize declarations. | Same CLI harness and deterministic allocation/inventory assertions; helper tests may be added beside it if a small extracted helper warrants them. |
| Meaning and history | Compare every migrated entry before/after using a finite mapping and meaning checklist; exact byte comparisons for 19 old detail plans, retained closed records/milestones, existing ADRs and migration-cited files. Explicitly separate the two merge catch-ups from renaming; their new closure/milestone lines and replacement of DM's stale `(this commit)` with its actual commit hash are the only historical-record edits permitted. | Baseline Git objects at `50c649f`; deterministic comparison/search plus Main's side-by-side review. Permit only stated live-reference/identity edits in active master plans and charters. |
| Repository integration | New contract, templates, index, redirects and real declarations pass together, without new broken links or changed unrelated import/skill rules. | `npm run docs:check`, `npm run docs:check:test`, `git diff --check`; `npx tsc --noEmit` and `npm run lint` (0 warnings/problems) for checker code changes. |
| Skill accessibility | Changed skill resources and external relative references resolve identically through canonical `.claude/skills/` and existing `.agents/skills/` symlinks. | Compare contents and targets as `skill-authoring` Verify requires; no new skills or links. |
| Owner readability | Owner reads examples, program codes and the migration/exception boundary and approves the proposed Spec. No product browser scenario is implicated. | Plan acceptance, followed by review of actual migrated examples; no browser/app/database suites required for unchanged product behavior. |

Use existing Node test tooling; add no package. Compare preserved tracked files at the Git-blob level (`git hash-object` against baseline blob IDs), accounting for checkout LF/CRLF conversion rather than treating it as an edit; compare preserved spans with the same line-ending normalization only. A sandbox denial creating a fixture's temporary `.git/config` is an environment failure: report it and use an authorized rerun, not weaker assertions. Baseline unit/RLS/E2E application runs are not evidence for this docs-only contract and are not required. Actual agent compliance with instructions is not proven by static tests.

### 1.6 Bounded migration inventory

Reconfirm these baseline candidates in CP1 preparation; do not infer state from a heading alone. This table specifies the canonical IDs, not permission to change an entry's substantive title or direction.

| Owning home | Old identifiers | Canonical identifiers |
| --- | --- | --- |
| backlog features | FEAT-012, FEAT-013, FEAT-014, FEAT-015, FEAT-016, FEAT-022, FEAT-023, FEAT-024 | BL-F1, BL-F2, BL-F3, BL-F4, BL-F5, BL-F6, BL-F7, BL-F8 |
| backlog problems | BL-003, BL-004, BL-006 | BL-P1, BL-P2, BL-P3 |
| agent-workflow features | FEAT-007, FEAT-010, FEAT-011, FEAT-025 | AW-F1, AW-F2, AW-F3, AW-F4 |
| agent-workflow problems | AW-002, AW-008 | AW-P1, AW-P2 |
| app-foundation feature | FEAT-005 | AF-F1 |
| app-foundation problems | AF-001, AF-002, AF-003, BL-005 | AF-P1, AF-P2, AF-P3, AF-P4 |
| dependency-maintenance features | FEAT-019, FEAT-020 | DM-F1, DM-F2 |
| dependency-maintenance problem | BL-009 | DM-P1 |
| unstarted app-foundation units | U2, U3, U4, U5, U6 | AF-U2, AF-U3, AF-U4, AF-U5, AF-U6 |
| this open initiative | U10, `u10-task-naming` | AW-U10, `aw-u10-task-naming` |

DM-001/002 close first under AC10 and retain those legacy IDs; they do not reserve numbers in the new DM-P sequence, so BL-009 becomes DM-P1. Historical legacy IDs remain file-qualified in the mapping and never become implicit aliases for a similarly numbered canonical ID. U sequences alone preserve prior unit numbers: AW U1–U9 plus this draft reserve 1–10; AF U1–U6 (completed or planned) reserve 1–6; DM U1 reserves 1. A subsequently allocated unit therefore starts at AW-U11, AF-U7 or DM-U2; the next AF unit to implement is the already-planned AF-U2. Closed pointers to migrated entries keep their original text; mappings disambiguate their former homes. Preserve original zero-padded identifiers when citing history.

## 2. Repository facts

Baseline: `50c649f7b58bca69e13747d5988911a44d1b278a` (`main`, PR #39 merged), checked 2026-10-29. Branch `chore/task-naming` started at that commit, clean before this plan.

- `program-docs` File roles/Plan shape requires U<n> table/title/folder matching and FEAT-NNN entries; Problems and future features requires stable problem IDs. Its templates and migration reference repeat those forms. These conflict with the requested naming/transfer change and must change with the checker (AC2/3/8/9).
- `docs/README.md` has five programs with Path/Lifecycle/Purpose but no code registry. The backlog is deliberately not a program (AC1).
- `check-structure.mjs` constants at lines 74–97 encode old unit/entry/feature forms; `checkProblems`, `checkFutureFeatures`, `checkPlanShape`, `parseProgramsTable` and `checkStructure` enforce declaration, ownership, transfer and index rules. The future-feature Moved pass requires an identical ID to exist in another file; problem uniqueness is currently per file (AC6–8).
- The three existing ALLOWLIST entries are path/rule exceptions, including the whole legacy security problems shape. New naming checks must not inherit that blanket exemption (AC6, G3).
- Discovery found 15 standard feature headings and 12 standard open problem headings; two problems are DM-001/002 awaiting a documentation catch-up although PR #32 is merged (`1c99b77`; commits `3c29a26`, `115739e`, `041dcbb`). The canonical migration therefore has 15 features and 10 standard problems (AC4/10).
- The 19 existing nested detail plans belong to completed work: AW U1–U9, infrastructure U1–U7 plus FEAT-017, dependency-maintenance U1, app-foundation U1. AF U2–U6 are master-plan rows without detail-plan files; no initiative plan is active before this draft (AC5).
- Published SQL cites `docs/programs/security-hotfix/plan.md` and `plan-h2.md` section 4.1. The legacy problems table contains P1–P31 and AW-003; `community.test.ts`, `profiles.test.ts` and payment specs use known-bug IDs such as P3/P4/P28/P5/P6/P25. Their paths, identities and test behavior stay unchanged (D4).
- Current feature references also occur in `dependency-updates`, `test-quality-strategy` and `frontend-workflow/references/manual-ui-validation.md`; AGENTS/charters/master plans cite old IDs or naming forms. Historical ADR/detail-plan/milestone references need traceability, not mass replacement (AC7/9).
- Baseline `npm run docs:check`: 0 structure/skill/import violations, one unchanged vendored broken-link baseline, zero new links. `npm run docs:check:test`: 72/72 passed on authorized rerun; initial sandbox run was 71/72 because the Git fixture could not write temporary `.git/config` (AC11).

## 3. Bounded implementation hypotheses

- Keep program codes in a Code column of `docs/README.md`, with BL reserved in `program-docs`; the checker reads this single registry. Do not create a second independently maintained registry in JavaScript (AC1).
- Extend `scripts/docs/check-structure.mjs` and its CLI tests. Small helper/data files under `scripts/docs/` may hold finite exceptions and transfer mappings with provenance; exact representation may change if AC6–8 remain machine-testable. Do not extend the existing broad ALLOWLIST to exempt new naming rules.
- Add ADR 0005 and its index row; update `program-docs` SKILL, migration reference and master/detail/charter/problem/feature templates together. Keep historical ADRs unchanged and name the precise old clauses superseded (AC9).
- Update current records under backlog, AW, AF and DM, the five program headers/index as needed, and only current affected skill/AGENTS references. The closed infrastructure follow-up lines and historical plan bodies remain unchanged. Produce a file-by-file edit classification before implementation; a search hit alone is not authorization to rewrite it.
- Keep the existing skill symlinks. Read each affected procedural skill fully when re-sizing implementation; reference-only updates must not change frontend, dependency or test execution behavior.
- Draft creation uses `u10-task-naming` and a U10 charter row so the current validator can validate this plan. In activation rename this directory, H1, live charter row/link and State pointer as one logical change; the approved Spec's substance and revision remain intact (AC5).

## 4. Checkpoints

One implementation checkpoint is intentional: splitting strict validator activation from live-data migration would leave an incoherent repository or require a permissive transition. Preparation and final review are steps inside this checkpoint, not extra commit boundaries.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Before activation: verify baseline/ownership, perform only the two merge catch-ups, freeze exact closed/security inventories, classify references and prove the migration mapping. Then activate the ADR/contract, templates, validator plus regression tests, all canonical records/references and this plan's own rename together. Finish with a full meaning/history/symlink review and current State. | All rows in 1.5; `npm run docs:check`, `npm run docs:check:test`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`; exact baseline comparisons and no unrelated changed files. Self-review until 0 Critical/Required, then a local checkpoint commit only if granted. Main checks the actual full diff/report. |

PR outcome: program-scoped work identifiers with preserved closed history. No unmerged dependency beyond baseline PR #39; it precedes the deferred AW-F4/AW-P2 pair (formerly FEAT-025/AW-008). This is sequential single-writer work, not parallel-safe. Commit, push, PR and merge remain separately granted; no runtime, hosted or CI configuration step is part of rollout.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A legacy rule conflicts with the proposed one. | ADR identifies naming/ID-transfer supersession; change the procedure, examples and checker together; retain unrelated lifecycle/ownership rules. Expose conflicts during inventory, before activation. |
| Baseline exceptions quietly admit future legacy work. | Exact declaration-level inventory, separate naming validation and negative fixtures for copied, reopened and newly closed entries, including security table rows. |
| Frozen Moved pointers lose their targets after renaming. | File-qualified mappings, canonical ownership checks and chained-transfer fixtures; test real historic pointers before activation completes. |
| Semantic drift in an approved master plan or historical evidence. | Permit identity/current-pointer substitutions only in active master/charter sections; byte-compare completed detail plans, closed records and historic milestones; review the meaning checklist. |
| Another session writes files or main advances during implementation. | Confirm baseline/ownership before writes. Stop and re-size/reconcile instead of silently expanding inventory or rewriting another writer's changes. |
| A future revert breaks documents already using the convention. | Prefer a bounded fix. A revert after downstream use requires Owner reconciliation of records/mappings and must preserve truthful State. |

- Rollout: plan self-review, Owner Spec approval and separate grants, assigned implementation, author self-review, Main diff/meaning review, then only authorized delivery with required checks. No hosted rollout or browser QA. Future tool/model compliance is unverified.
- Stop when: G6 applies; a source cannot preserve its meaning or path; strict checks require a new permission or runtime change; an affected skill widens authority; or a historical exception cannot be bounded without hiding new declarations.
- Rollback before delivery: fix the uncommitted candidate, or use new correction commits after a committed review; no destructive reset. After merge, fix forward unless the Owner explicitly authorizes a coordinated revert. Never restore obsolete State as current or delete historical evidence.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

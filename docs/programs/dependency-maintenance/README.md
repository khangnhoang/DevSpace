# Charter — dependency-maintenance

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each initiative has a detail plan at `implementation-plans/dm-u<n>-<slug>/plan.md`. Decision: [ADR 0004](../../adr/0004-dependency-maintenance-program.md). Procedure: the `dependency-updates` skill (`.claude/skills/dependency-updates/SKILL.md`).

## 1. Capability and boundary

- Capability: DevSpace's npm dependencies, the Node version (production, CI, `@types/node`), the exact pins (Supabase CLI, `@playwright/test`) and the Monaco version loaded from the CDN stay current and free of known high or critical findings on a production path. The program records each dependency check and runs the update initiatives it calls for.
- Boundary: the update procedure and the dependency rows live in the `dependency-updates` skill, whose content this program maintains; adding a new package for a feature belongs to the program that needs it (`app-foundation` adds Zod, React Hook Form and shadcn with their rows); replacing packages during the techstack migration belongs to that program; the Supabase auth helpers wait for it (ADR 0001); CI jobs other than a Node version change belong to their owning program.

## 2. Owner decisions

One line each: number, date, decision. The decisions of each initiative stay in its plan.

1. (2026-10-27) `dependency-maintenance` is an evergreen program that takes over dependency upkeep from infrastructure when infrastructure closes (ADR 0004).
2. (2026-10-27) Dependency check results and dependency findings are recorded in this program's `problems.md` and `future-features.md`; backlog entries FEAT-019, FEAT-020 and BL-009 move here (now DM-F1, DM-F2 and DM-P1).
3. (2026-10-27) An initiative that updates several packages at once, or a runtime library on an auth, payment or data path, gets a detail plan and the Codex gate on its plan and on its diff.

## 3. Invariants

Each initiative keeps these; the rule itself lives with its owner.

- An update follows its type's procedure and passes the Dependency row before it merges (`dependency-updates`, Workflow) — prevents an update that breaks a path no check ran.
- A major update is its own initiative or task, never inside another change (`dependency-updates`, Major) — prevents a breaking change hidden in a batch.
- A dependency check changes only records and installs nothing (`dependency-updates`, Dependency check) — prevents an update without the Owner's request.
- No product behavior changes inside an update initiative, except what a breaking change forces and its plan names — prevents a feature change reviewed as a version bump.

## 4. Initiatives

At most one initiative has an open plan at a time. A closed initiative keeps its row.

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| U1 [In-range patch and minor updates](implementation-plans/u1-in-range-updates/plan.md) | `chore/deps-in-range-updates` | Every package behind within its major on 2026-10-27 is updated, except the Supabase CLI, with the full suite and a manual pass green. | none | Owner approval of the plan after the Codex plan gate |
| DM-U2 [nodemailer 10](implementation-plans/dm-u2-nodemailer-10/plan.md) | `chore/dm-u2-nodemailer-10` | DM-P1's high `nodemailer` finding is fixed by 10.3.1, `@types/nodemailer` is removed, and the e2e mail record and network guard still stop every real send. | none | Owner approval of the plan after the Codex plan gate |

## 5. Opening an initiative

1. A dependency check (`dependency-updates`, Dependency check) or the Owner names the work; the result is an entry in `problems.md` or `future-features.md` of this program.
2. Main confirms no initiative of this program has an open plan (ADR 0002) and sizes the work (`docs/agent-loops.md`, Sizing). A single patch or minor of one package that meets the small-task conditions needs no plan and no row; it is one milestone in `progress.md`.
3. Otherwise Main writes the detail plan at `implementation-plans/dm-u<n>-<slug>/plan.md` with the next `DM-U<n>` under the allocation rule in `program-docs`, adds its row above, and self-reviews it; decision 3 and `.claude/rules.md` sections 2 and 3 decide the Codex gate.
4. The Owner approves the plan; State in `progress.md` then names the initiative and its revision.

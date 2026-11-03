# Charter — ui-ux

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each initiative has a detail plan at `implementation-plans/ux-u<n>-<slug>/plan.md`. Decision: [ADR 0006](../../adr/0006-ui-ux-program.md). Procedure: the `frontend-design` skill (`.claude/skills/frontend-design/SKILL.md`).

## 1. Capability and boundary

- Capability: DevSpace's existing learner, public and admin screens look coherent and work well at phone, tablet and desktop widths. The program records upgrade audits of those screens and runs the upgrades and redesigns they call for, under the `frontend-design` skill.
- Boundary: the form, validation and confirm-dialog conversions of `app-foundation` stay there while that program is open; data, server actions, RLS and new features belong to their owning program or the backlog; adding a package or font follows `AGENTS.md` section 4 and `dependency-updates`; test tooling belongs to `quality-engineering`.

## 2. Owner decisions

One line each: number, date, decision. The decisions of each initiative stay in its plan.

1. (2026-11-03) `ui-ux` is an evergreen program with code `UX` that owns the visual quality and experience of existing screens (ADR 0006).
2. (2026-11-03) Backlog BL-F10, the profile page upgrade with eight audit findings, moves here as UX-F1 and is the first initiative.
3. (2026-11-03) The program opens in a docs-only PR; each initiative is its own PR.

## 3. Invariants

Each initiative keeps these; the rule itself lives with its owner.

- An upgrade starts with an audit whose findings the Owner picks from (`frontend-design`, Upgrade an existing screen) — prevents changes the Owner did not choose.
- Every changed screen gets the Visual review at about 375px, tablet and desktop before it is reported done (`frontend-design`, Visual quality) — prevents a fix that only looks right at the width it was built at.
- No data, server action or RLS change inside an initiative unless its plan names it and its owner's skill is followed — prevents a backend change reviewed as styling.
- Shared components change only under `frontend-design` (Classify the screen first) — prevents one screen's fix breaking another.

## 4. Initiatives

At most one initiative has an open plan at a time. A closed initiative keeps its row.

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| UX-U1 [Upgrade the learner profile page](implementation-plans/ux-u1-profile-upgrade/plan.md) | `feat/ux-u1-profile-upgrade` | UX-F1: course cards lead back into learning, every enrolled course in order, a phone layout without sideways scrolling, empty fields hidden, Vietnamese dates and amounts | none | Owner approval of the plan |

## 5. Opening an initiative

1. An upgrade audit or the Owner names the work; the result is an entry in this program's `problems.md` or `future-features.md`.
2. Main confirms no initiative of this program has an open plan (ADR 0002) and sizes the work (`docs/agent-loops.md`, Sizing). A fix that meets the small-task conditions needs no plan and no row; it is one milestone in `progress.md`.
3. Otherwise Main writes the detail plan at `implementation-plans/ux-u<n>-<slug>/plan.md` with the next `UX-U<n>` under the allocation rule in `program-docs`, adds its row above and self-reviews it; `AGENTS.md` section 3 decides the Codex gate.
4. The Owner approves the plan; State in `progress.md` then names the initiative and its revision.

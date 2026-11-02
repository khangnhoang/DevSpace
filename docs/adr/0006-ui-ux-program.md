# ADR 0006: UI/UX program

Date: 2026-11-03. Status: Accepted.

## Context

The `frontend-design` skill gained Visual quality lenses, a browser review and an upgrade mode on 2026-11-03 (PR 54). Its first upgrade audit, of the learner profile page during the post-AF-U3 batch (PR 55), found eight problems that are not bugs of one feature: cards that link nowhere, a table that scrolls sideways on a phone, empty fields shown as "Trống", a sidebar too narrow on a tablet, raw dates and amounts. No program owns the look and experience of existing screens: `app-foundation` converts forms and dialogs to shadcn, React Hook Form and Zod and then closes; `quality-engineering` keeps product changes with their owning program; the backlog holds single items, not a capability. The frontend stays Next.js after the techstack migration ([ADR 0001](0001-modernization-roadmap.md)), so this work is not replaced by it.

## Decision

1. An evergreen program, `ui-ux` (`docs/programs/ui-ux`, code `UX`), owns the visual quality and user experience of DevSpace's existing screens: upgrade audits, upgrades and redesigns done under the `frontend-design` skill.
2. Its boundary: the form, validation and confirm-dialog conversions planned by `app-foundation` stay there while that program is open; data, server actions, RLS and new features belong to their owning program or the backlog; adding a package follows `AGENTS.md` section 4 and `dependency-updates`.
3. It runs alongside the roadmap and does not change its order ([ADR 0001](0001-modernization-roadmap.md), [ADR 0003](0003-app-foundation-program.md)).

## Consequences

- UI/UX findings without a feature owner go to this program's `problems.md` or `future-features.md` instead of `docs/backlog/`; backlog BL-F10 (the profile page upgrade) moves here as UX-F1.
- A screen that `app-foundation` still has to convert can be audited here, but its form changes wait for or coordinate with that unit.
- The `frontend-design` skill stays the procedure; this program records the audits and runs the initiatives they call for.

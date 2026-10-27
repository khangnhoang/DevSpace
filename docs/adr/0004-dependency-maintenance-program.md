# ADR 0004: Dependency maintenance program

Date: 2026-10-27. Status: Accepted.

## Context

Infrastructure U7 (PR 29) wrote the dependency policy as the `dependency-updates` skill: one procedure per update type, a table of special-case rows, and a manual dependency check when a delivery program opens or closes and whenever the Owner asks. With U7 merged, infrastructure closes, and nothing owns the work the policy produces: the first check on 2026-10-27 found 17 packages behind within their major (most installed in 2025), majors waiting (FEAT-020), the Node move (FEAT-019) and security findings with no in-range fix (BL-009), all in the backlog. Updating many packages at once touches most of the app, so the Owner asked on 2026-10-27 for a program that owns it with plans and reviews, since dependencies need care for as long as the repo lives.

## Decision

1. An evergreen program, `dependency-maintenance` (`docs/programs/dependency-maintenance`), owns keeping DevSpace's dependencies current and safe: the results of each dependency check, the update initiatives, and the dependency findings that are not yet fixed.
2. It receives the capability from infrastructure when infrastructure closes. The `dependency-updates` skill stays the procedure; its tooling-specific content is maintained by this program.
3. It runs alongside the roadmap and does not change its order ([ADR 0001](0001-modernization-roadmap.md), [ADR 0003](0003-app-foundation-program.md)).

## Consequences

- Dependency check results and dependency findings are recorded in this program's `problems.md` and `future-features.md`, not in `docs/backlog/`.
- A package that another program adds (Zod, React Hook Form and shadcn in `app-foundation`) is added by that program's unit with its row in the skill (infrastructure U7 D1); its later updates belong here.
- Parts the techstack migration replaces (the Supabase auth helpers) are still not modernized (ADR 0001); replacing packages as part of the migration belongs to that program.
- Program-boundary checks stay where `program-docs` puts them: opening and closing a delivery program include the dependency check, now recorded here.

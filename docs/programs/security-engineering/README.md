# Charter — security-engineering

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each initiative has a detail plan at `implementation-plans/se-u<n>-<slug>/plan.md`. Decision: [ADR 0007](../../adr/0007-security-engineering-program.md). Procedures: the `supabase-migration` and `server-actions` skills.

## 1. Capability and boundary

- Capability: the security and data integrity of DevSpace's current stack (Next.js, server actions, Supabase Auth, RLS, grants, Storage) hold until and through the techstack migration. The program records findings, fixes the ones that expose production data to the wrong actor today, and hands the rest to the migration as acceptance criteria.
- Boundary: a UI-only defect goes to `ui-ux` or the backlog; test tooling goes to `quality-engineering`; dependency audits stay with `dependency-maintenance`; the techstack migration itself is its own program. A problem is "Open, before migration" only if data is readable or writable by the wrong actor on production today; a gap that the migration rewrites is "Deferred to techstack-migration" and becomes an acceptance criterion there. The `security-hotfix` program is closed; its plans stay at `../security-hotfix/` as historical contracts.

## 2. Owner decisions

One line each: number, date, decision. The decisions of each initiative stay in its plan.

1. (2026-11-05) `security-engineering` is an evergreen program with code `SE` (ADR 0007); `security-hotfix` closes and hands over its open security entries and the backlog security entries, and H2-2b becomes initiative SE-U1.
2. (2026-11-05) Before the techstack migration only production exposures are fixed (data readable or writable by the wrong actor on production today); the other entries become acceptance criteria of the techstack migration.
3. (2026-11-05) The program opens in a docs-only PR; each initiative is its own PR.

## 3. Invariants

Each initiative keeps these; the rule itself lives with its owner.

- A policy, grant, RLS or auth change follows `supabase-migration` and the Codex gate (`AGENTS.md` section 3) — prevents an access-control change applied to hosted without review or rollback.
- No investment in a part the techstack migration replaces ([ADR 0001](../../adr/0001-modernization-roadmap.md)), except a fix for an "Open, before migration" exposure — prevents work that the migration throws away.
- The `security-hotfix` plan paths that published migrations cite (`docs/programs/security-hotfix/plan.md`, `plan-h2.md`) never move or rename, and the folder stays on the docs-check allowlist — prevents a published migration pointing at a missing file.

## 4. Initiatives

At most one initiative has an open plan at a time. A closed initiative keeps its row. No initiative is open.

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| SE-U1 [H2-2b coupon and payment write integrity](../security-hotfix/plan-h2.md) | `fix/se-u1-payment-write-integrity` | SE-P8, SE-P9, SE-P10, SE-P11 and SE-P12: coupon usage is reserved and counted consistently, order approval and rejection are atomic, and an enrolled user cannot create a redundant pending order | none | Owner approval of a detail plan; Codex gate |

## 5. Opening an initiative

1. The Owner names the work, or a finding is recorded first as an entry in this program's `problems.md` or `future-features.md` with its label.
2. Main confirms no initiative of this program has an open plan (ADR 0002) and sizes the work (`docs/agent-loops.md`, Sizing). A fix that meets the small-task conditions needs no plan and no row; it is one milestone in `progress.md`.
3. Otherwise Main writes the detail plan at `implementation-plans/se-u<n>-<slug>/plan.md` with the next `SE-U<n>` under the allocation rule in `program-docs` and adds its row above. SE-U1 starts from the H2-2b scope and the reservation design in [plan-h2.md](../security-hotfix/plan-h2.md). The Codex gate runs on the plan and on the implementation diff, because every initiative touches auth, payment, permissions or the schema (`AGENTS.md` section 3).
4. The Owner approves the plan; State in `progress.md` then names the initiative and its revision. A hosted step follows `supabase-migration` (Hosted apply) with its separate grants.

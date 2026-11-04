# ADR 0007: Security Engineering program

Date: 2026-11-05. Status: Accepted.

## Context

`security-hotfix` is a delivery program. H1 (privilege escalation) and H2-1 (profile, coupon and paid-content exposure) shipped, and H2-2a (community write integrity) shipped on 2026-10-31. What it still holds is a list of open problems and one deferred unit (H2-2b, coupon and payment write integrity), with no single goal left to complete. Security and data-integrity findings also sit in the backlog (BL-P7, BL-P9, BL-P10, BL-P14, BL-P15, BL-P16) because no program owns them. The techstack migration ([ADR 0001](0001-modernization-roadmap.md)) will rewrite the server code and the data access layer, so work spent on another business-logic gap the migration replaces is wasted, while a hole that exposes production data today cannot wait for it. [AW-F2](../programs/agent-workflow/future-features.md) already named Security Engineering as the evergreen program to open when `security-hotfix` closes.

## Decision

1. An evergreen program, `security-engineering` (`docs/programs/security-engineering`, code `SE`), owns the security and data integrity of the current stack until and through the techstack migration. `security-hotfix` closes; it hands its open security entries and the backlog's security entries to the new program, and H2-2b becomes its initiative SE-U1.
2. Before the migration only production exposures are fixed: data readable or writable by the wrong actor on production today, or a write that corrupts payment, coupon or permission state on production today. Other gaps in business logic that the migration rewrites, outside that definition, are recorded as deferred problems and become acceptance criteria of the techstack migration.
3. Entries that are not security go to their owners: UI defects to `ui-ux`, unrelated bugs to the backlog.

## Consequences

- Open security problems have one owner and a label: "Open, before migration" (a production exposure as Decision 2 defines it, which includes the H2-2b entries and the role constraint) or "Deferred to techstack-migration" (for example SE-P19, quiz answers reaching an enrolled learner's client, which the migration fixes by grading on the server). The deferred ones are the input to the migration's acceptance criteria when that program opens.
- A policy, grant, RLS or auth change still follows `supabase-migration` and the Codex gate (`AGENTS.md` section 3); this program grants no permission.
- The `security-hotfix` plan files stay where they are, because published migrations cite their paths.
- Dependency audits stay with `dependency-maintenance`; test tooling stays with `quality-engineering`.
- The roadmap order is unchanged.

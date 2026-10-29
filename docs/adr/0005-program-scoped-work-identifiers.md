# ADR 0005: Program-scoped work identifiers

Date: 2026-10-29. Status: Accepted (Owner-approved AW-U10 r2).

## Context

Global FEAT numbers and unqualified problem/unit IDs hide ownership. Work has moved between backlog and programs while historical plans and published migrations depend on existing paths and identifiers.

## Decision

Use program-scoped identifiers with independent local F, P and U sequences, registered program codes and reserved backlog BL. The executable shape, allocation and transfer procedure is owned by [program-docs](../../.claude/skills/program-docs/SKILL.md#identifier-allocation-and-transfers). Open entries migrate using the fixed AW-U10 r2 inventory; closed history stays intact with exact naming-only exceptions and file-qualified transfer mappings.

This supersedes only conflicting naming and ID-stability clauses: program-docs File roles/Plan shape (bare U IDs, folders/titles and root detail titles), Problems and future features (FEAT-NNN global uniqueness and keeping a problem ID across owner changes), and the corresponding templates/migration instructions. Historical naming examples in ADR 0002 and ADR 0003 remain historical; their lifecycle, ownership, gates and other decisions remain in force. No permission, role or execution rule changes.

## Consequences

- Readers see owner, kind and number; new ownership receives the destination's next number and a traceable pointer/mapping.
- Historical declarations cannot admit new legacy work. Naming validation is separate from security-hotfix shape exceptions; unrelated field/link checks remain.
- Allocation uses highest issued number plus one, including planned U rows and closed/moved canonical IDs. No gap checker, warning or ledger is introduced. Future agent compliance remains unverified by static checks.

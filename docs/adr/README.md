# Architecture decision records

A decision that outlives one program or spans programs is recorded here; a decision that matters to one program stays in that program's plan. Every ADR except this index is listed below with its date, status and a one-line summary. Create one from the template in the `program-docs` skill.

| ADR | Date | Status | Summary |
| --- | --- | --- | --- |
| [0001 Modernization roadmap](0001-modernization-roadmap.md) | 2026-10-22 | Accepted, order amended by 0003 | Programs run in the order agent-workflow, infrastructure, techstack-migration; parts the migration replaces are not modernized. |
| [0002 Program kinds](0002-program-kinds.md) | 2026-10-23 | Accepted | Delivery programs close; evergreen programs own a capability, have a charter README.md and one open initiative at a time; the kind is the Lifecycle value. |
| [0003 App foundation program](0003-app-foundation-program.md) | 2026-10-25 | Accepted | An app-foundation program (shadcn, React Hook Form, Zod on client and server) runs between infrastructure and techstack-migration. |
| [0004 Dependency maintenance program](0004-dependency-maintenance-program.md) | 2026-10-27 | Accepted | An evergreen `dependency-maintenance` program owns dependency checks, update initiatives and dependency findings, taking the capability from infrastructure; the roadmap order is unchanged. |
| [0005 Program-scoped work identifiers](0005-program-scoped-work-identifiers.md) | 2026-10-29 | Accepted | Program codes, independent local F/P/U numbering, mapped owner transfers and bounded historical naming exceptions. |
| [0006 UI/UX program](0006-ui-ux-program.md) | 2026-11-03 | Accepted | An evergreen `ui-ux` program owns the visual quality and experience of existing screens under `frontend-design`; app-foundation keeps its form conversions; the roadmap order is unchanged. |

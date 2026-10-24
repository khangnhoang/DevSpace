# Architecture decision records

A decision that outlives one program or spans programs is recorded here; a decision that matters to one program stays in that program's plan. Every ADR except this index is listed below with its date, status and a one-line summary. Create one from the template in the `program-docs` skill.

| ADR | Date | Status | Summary |
| --- | --- | --- | --- |
| [0001 Modernization roadmap](0001-modernization-roadmap.md) | 2026-10-22 | Accepted, order amended by 0003 | Programs run in the order agent-workflow, infrastructure, techstack-migration; parts the migration replaces are not modernized. |
| [0002 Program kinds](0002-program-kinds.md) | 2026-10-23 | Accepted | Delivery programs close; evergreen programs own a capability, have a charter README.md and one open initiative at a time; the kind is the Lifecycle value. |
| [0003 Frontend foundation program](0003-frontend-foundation-program.md) | 2026-10-25 | Accepted | A frontend-foundation program (shadcn, React Hook Form, Zod on client and server) runs between infrastructure and techstack-migration. |

# Docs

Documentation for DevSpace. Docs are in English; text the app shows to users stays in Vietnamese, and such strings are quoted as they appear in the product. Run `npm run docs:check` after editing anything here; the `program-docs` skill (`.claude/skills/program-docs/SKILL.md`) owns the shape of every document below. The API's architecture and hosting decisions are in [ADR 0008](adr/0008-backend-architecture-and-hosting.md); where its code lives is in the code map of `AGENTS.md`.

## Folders

| Path | Purpose |
| --- | --- |
| [agent-loops.md](agent-loops.md) | Sizing of work, the lifecycle loops (planning, checkpoint, review, PR and CI) and the self-review method. Shared lifecycle read alongside `AGENTS.md`; imported directly by `CLAUDE.md`. |
| [agent-models.md](agent-models.md) | Owner-selected models and effort for exploration, implementation and independent review in Codex and Claude; Main keeps the current chat selection. Read before assigning models. |
| [codex-app-sessions.md](codex-app-sessions.md) | App-chat dispatch, result/receipt correlation and bounded failure handling. Read only for actual Codex app chat handoffs and their recipients; CLI invocations, including `codex exec` launched from the app, keep their existing paths. |
| [programs/](programs/) | One folder per program of work, each with `plan.md` (an evergreen program: a charter `README.md` instead), `progress.md` and `problems.md`, and optionally `future-features.md` and `implementation-plans/`. |
| [adr/](adr/README.md) | Architecture decision records: decisions that outlive one program or span programs. |
| [backlog/](backlog/) | Future features and problems that no open program owns. It is not a program. |

## Programs

Status lives in each program's `progress.md`, never in this table.

| Path | Code | Lifecycle | Purpose |
| --- | --- | --- | --- |
| `programs/agent-workflow` | AW | evergreen | Agent rules, skills, lifecycle loops and docs checks for working on DevSpace with Claude Code and Codex. |
| `programs/infrastructure` | INF | closed | Test infrastructure (Vitest, Playwright), an isolated Supabase local with seed data, and CI on GitHub Actions. |
| `programs/quality-engineering` | QE | evergreen | Test-data safety, shared test tooling, regression coverage and CI maintenance; product changes stay with their owning program. |
| `programs/dependency-maintenance` | DM | evergreen | Keeping dependencies current and safe: the dependency check results, update initiatives and dependency findings ([ADR 0004](adr/0004-dependency-maintenance-program.md)). |
| `programs/app-foundation` | AF | closed | shadcn, React Hook Form and Zod for every form and confirm dialog, and Zod validation in server actions ([ADR 0003](adr/0003-app-foundation-program.md)). |
| `programs/security-hotfix` | SH | closed | Security fixes H1 and H2 (privilege escalation, data exposure, write integrity); community write integrity is specified in the [SH-P3 entry plan](programs/security-hotfix/implementation-plans/sh-p3-community-write-integrity/plan.md). |
| `programs/security-engineering` | SE | evergreen | Security and data integrity of the current stack until and through the techstack migration: production exposures are fixed first, the rest become migration acceptance criteria ([ADR 0007](adr/0007-security-engineering-program.md)). |
| `programs/ui-ux` | UX | evergreen | Visual quality and user experience of existing screens: upgrade audits, upgrades and redesigns under `frontend-design` ([ADR 0006](adr/0006-ui-ux-program.md)). |
| `programs/techstack-migration` | TM | active | The move of DevSpace's data operations to a NestJS API with Drizzle, domain by domain with production data kept, on Supabase Postgres, Auth and Storage (roadmap step 4, [ADR 0001](adr/0001-modernization-roadmap.md)). |

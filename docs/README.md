# Docs

Documentation for DevSpace. Docs are in English; text the app shows to users stays in Vietnamese, and such strings are quoted as they appear in the product. Run `npm run docs:check` after editing anything here; the `program-docs` skill (`.claude/skills/program-docs/SKILL.md`) owns the shape of every document below.

## Folders

| Path | Purpose |
| --- | --- |
| [agent-loops.md](agent-loops.md) | Sizing of work, the lifecycle loops (planning, checkpoint, review, PR and CI) and the self-review method. Shared lifecycle read alongside `AGENTS.md`; imported directly by `CLAUDE.md`. |
| [programs/](programs/) | One folder per program of work, each with `plan.md` (an evergreen program: a charter `README.md` instead), `progress.md` and `problems.md`, and optionally `future-features.md` and `implementation-plans/`. |
| [adr/](adr/README.md) | Architecture decision records: decisions that outlive one program or span programs. |
| [backlog/](backlog/) | Future features and problems that no open program owns. It is not a program. |

## Programs

Status lives in each program's `progress.md`, never in this table.

| Path | Code | Lifecycle | Purpose |
| --- | --- | --- | --- |
| `programs/agent-workflow` | AW | evergreen | Agent rules, skills, lifecycle loops and docs checks for working on DevSpace with Claude Code and Codex. |
| `programs/infrastructure` | INF | closed | Test infrastructure (Vitest, Playwright), an isolated Supabase local with seed data, and CI on GitHub Actions. |
| `programs/dependency-maintenance` | DM | evergreen | Keeping dependencies current and safe: the dependency check results, update initiatives and dependency findings ([ADR 0004](adr/0004-dependency-maintenance-program.md)). |
| `programs/app-foundation` | AF | active | shadcn, React Hook Form and Zod for every form and confirm dialog, and Zod validation in server actions ([ADR 0003](adr/0003-app-foundation-program.md)). |
| `programs/security-hotfix` | SH | active | Security fixes H1 and H2 (privilege escalation, data exposure, write integrity); H2-2 is deferred. |

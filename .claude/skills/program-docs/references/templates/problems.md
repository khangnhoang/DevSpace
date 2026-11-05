<!-- Template: problems. Copy to docs/programs/<program>/problems.md (or docs/backlog/problems.md), fill every <placeholder>, delete this comment. Replace the header filenames with real Markdown links: a delivery program links plan.md and progress.md; an evergreen program links its charter README.md and progress.md. For docs/backlog/, remove the Plan/Progress line because the backlog has neither file. Keep IDs stable within the owner; transfers allocate the destination’s next local number and retain a mapped pointer (program-docs, Identifier allocation and transfers). When resolved, move any still-live follow-up into an open entry, then shrink the entry to one line. In docs/backlog/, closed entries use the forms in the program-docs skill (Done, Moved to, Dropped). -->

# Problems, risks and follow-ups — <program name>

Plan: `plan.md`. Progress: `progress.md`.

## Open

### <CODE>-P<n>: <short title>

- Status: <Open, Deferred, Accepted, Blocked> (<date, Owner decision if any>).
- Problem: <what is wrong or risky>.
- Evidence: <commands, commits, links, observations>.
- Direction: <intended handling and which unit or program owns it>.
- Exit condition: <observable condition that resolves it>.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- <CODE>-P<n> — Resolved <YYYY-MM-DD>: <one-line outcome> (`<commit>` or PR <n>).

# Problems, risks and follow-ups — quality-engineering

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

None.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- QE-P1 — Resolved 2026-11-01: RLS teardown waits up to 10 s for registered writers before releasing ownership, and the `rls` project has a measured 15 s test timeout; guards stay fail-closed (PR 46, `3e4b941`).
- QE-P2 — Resolved 2026-11-02: tests run on a separate `devspace-test` stack under one machine-wide lock with writer records and an end-of-run audit; the ownership journal and `recover.mjs` are gone, and an interrupted run is cleaned up by the next command (PR 50, `60c369a`).

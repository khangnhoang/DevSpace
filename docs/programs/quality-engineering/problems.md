# Problems, risks and follow-ups — quality-engineering

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### QE-P2: ownership journals retained on Windows that recovery cannot always clear

- Status: Open (2026-11-01, recorded during dependency-maintenance DM-U4).
- Problem: during DM-U4, six local ownership journals under `C:\ProgramData\devspace-fixture-ownership-v1\` blocked the next run. Each held no recorded resources. Four causes were observed:
  - (1) An e2e run ended with `Writer descendants are still alive; ownership retained`, although the writers exited soon after. `runManagedChild` waits at most 10 s (`awaitWritersExit`, `__tests__/helpers/managed-run.mjs:38`) for 87 registered writers.
  - (2) Stopping `npm run dev` from the desktop preview (`preview_stop`) leaves its journal in phase `open` with a dead owner, so the next dev or test run is refused.
  - (3) `recover.mjs` refuses a journal whose stack identity changed after `npx supabase db reset`.
  - (4) `recover.mjs` refuses a journal whose writer pid was reused by an unrelated process (an e2e run piped into `head`, pid reused by `msedge`).
  - Causes (3) and (4) needed a manual journal removal, which `fixture-recovery.md` forbids, so each removal was approved by the Owner one journal at a time.
- Evidence: observed on 2026-11-01 on branch `fix/dm-u4-monaco-self-host`.
  - (1) Journal `ce1af36a-…`: its run printed the message above. `recover.mjs inspect` then showed the owner dead, 0 entries and 0 of 87 writers alive, and `recover.mjs apply` cleared it.
  - (2) Journals `8e436200-…` and `cd978a3c-…` (mode `dev`, phase `open`, owner pid dead, 0 entries); `apply` cleared `cd978a3c`.
  - (3) and (4): journals `8e436200-…` and `18d88ba2-…`, removed by hand with Owner approval.
  - A gate timeout in `joinRun` was a separate cause, fixed by DM-U4 `82fee44`.
- Direction: Owner direction (2026-11-01), not yet planned or verified. Run tests on their own local Supabase stack, separate from the dev stack, and then simplify the ownership layer instead of patching it.
  - With two stacks, the dev data is out of reach of test cleanup and resets. The test stack is disposable and can be reset freely. Keep tag-based fixture identity and cleanup. Replace the gate, membership, process-tree and writer-exit checks with one run lock that records a pid and start time, and treat the lock as stale when that process is gone. Sweep leftover e2e-tagged rows at start.
  - To verify in the plan: running two stacks with the repository-pinned Supabase CLI (a second config and project id with its own ports); Docker memory with both stacks up; `buildE2eEnv` and the host check reading the test stack instead of `npx supabase status` of the dev stack; the CI job, which runs one stack only; and each guard of the QE-U1 invariants. Each guard is either kept or dropped, with the reason the separate stack covers it.
  - Fallback if two stacks prove impractical: keep one stack and patch the four cases. Measure the writer-exit deadline on Windows. Close the dev journal when the server is killed. Let `recover.mjs` detect a reused pid by its start time and a reset stack.
- Exit condition: on Windows, a passing `npm run test:e2e` and a stopped dev preview leave no journal, and the four cases above are cleared by `recover.mjs` without manual removal.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- QE-P1 — Resolved 2026-11-01: RLS teardown waits up to 10 s for registered writers before releasing ownership, and the `rls` project has a measured 15 s test timeout; guards stay fail-closed (PR 46, `3e4b941`).

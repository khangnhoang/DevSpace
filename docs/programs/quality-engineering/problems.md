# Problems, risks and follow-ups — quality-engineering

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### QE-P1: Windows full-suite lifecycle can retain ownership after completion

- Status: Open (2026-10-31); intermittent verification failure observed during security-hotfix SH-P3/SH-P4, not fixed by that task. Later consecutive default runs passed, so it no longer blocks that checkpoint.
- Problem: A full `npm test` on Windows can finish its assertions but exit 1 when RLS global teardown calls `releaseRun` and it reports registered writer descendants still alive. Another run timed out in an E2E-preflight row and retained a closing scope, blocking subsequent scopes. The ownership checks fail closed; their behavior must not be bypassed to obtain a green run.
- Evidence: On branch `fix/h2-community-write-integrity` after baseline `bed90f6`, outside the sandbox: the first full run failed 83/261 assertions after `e2e-preflight.test.ts` exceeded 5000 ms; the isolated community regression then passed 20/20. The next full run passed 261/261 assertions in 22 files but exited 1 with `Writer descendants are still alive; ownership retained` from `__tests__/rls/global-setup.ts` teardown and `__tests__/helpers/run-ownership.mjs`. Inspection after exit found no remaining entries and all eight recorded writers dead; explicit recovery of the exact run completed. Two later default `npm test` commands passed 261/261 each and exited 0 without a reset/recovery between them; all 14 public tables stayed unchanged and ownership released normally. No harness file changed in the security task; the cause and reliable reproduction remain unestablished.
- Direction: Investigate the Windows Vitest teardown/worker lifetime boundary and the preflight timeout under QE ownership, retaining descendant/request fencing and exact recovery. The Owner decides follow-up scope; do not change the harness, weaken guards or reset as a recovery shortcut in SH-P3/SH-P4.
- Exit condition: The lifecycle/timing cause is addressed or the Owner accepts a documented environment limitation; regression evidence preserves seed/residue checks, normal ownership release and safe recovery of failed/interrupted runs. Later passing runs alone do not establish a harness fix.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

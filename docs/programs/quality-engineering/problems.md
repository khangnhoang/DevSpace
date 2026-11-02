# Problems, risks and follow-ups — quality-engineering

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### QE-P3: Windows can reserve the local stack ports

- Status: Open (2026-11-03).
- Problem: both local stacks publish ports inside the Windows dynamic port range (49152–65535): dev 54320–54329, test 55320–55329. Hyper-V and WinNAT reserve blocks of that range for Docker and WSL and may pick other blocks after a restart, so a stack can lose its published ports or fail to start with no repo change. The test stack has the same exposure.
- Evidence: 2026-11-03, the dev stack containers ran with no published ports and the browser got `ERR_CONNECTION_REFUSED` on `127.0.0.1:54321`; `npx supabase start` then failed with `listen tcp 0.0.0.0:54322: bind: An attempt was made to access a socket in a way forbidden by its access permissions`; `netsh int ipv4 show excludedportrange protocol=tcp` listed 54236–54335 (not administered). `net stop winnat` and `net start winnat` (admin) released it and the stack started from its backup with its data.
- Direction: a QE initiative moves both stacks to ports outside the dynamic range. Before choosing them, check `netsh int ipv4 show dynamicport tcp`, the IPv4 and IPv6 `excludedportrange` lists and the listening processes on the candidate ports. A port below 49152 can still be excluded or in use, so this is a check, not a guarantee. Change both stacks in one PR: `supabase/config.toml`, `scripts/test-stack/config.mjs`, `.github/workflows/ci.yml`, the unit tests that assert the ports or the stack identity, `AGENTS.md`, `README.md` and `test-quality-strategy`; earlier plans stay as they are. A port change needs only a stack restart, not a reset: keep the dev data and reset only with a recovery path and the Owner's request. Until then, the workaround is the winnat restart above.
- Exit condition: both stacks publish ports outside the dynamic range that the checks showed free, `npm test` and `npm run test:e2e` pass, CI is green, and the dev stack restarts on the new ports with its data.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- QE-P1 — Resolved 2026-11-01: RLS teardown waits up to 10 s for registered writers before releasing ownership, and the `rls` project has a measured 15 s test timeout; guards stay fail-closed (PR 46, `3e4b941`).
- QE-P2 — Resolved 2026-11-02: tests run on a separate `devspace-test` stack under one machine-wide lock with writer records and an end-of-run audit; the ownership journal and `recover.mjs` are gone, and an interrupted run is cleaned up by the next command (PR 50, `60c369a`).

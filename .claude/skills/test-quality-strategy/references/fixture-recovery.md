# Local fixture ownership and recovery

Read this when a local run was interrupted, a managed command reports retained ownership, or you change the writer/request lifecycle. Permissions remain in [AGENTS.md section 4](../../../../AGENTS.md#4-permissions); normal data rules remain in [Test data](../SKILL.md#test-data).

## Inspect first

1. Keep the journal. Its location is printed by the conflicting command: `<Windows CommonApplicationData or Linux /var/tmp>/devspace-fixture-ownership-v1/<endpoint hash>/`. It is shared across processes, checkouts and accounts on this machine, independent of TEMP/HOME/ProgramData overrides; insufficient directory permissions block acquisition rather than selecting a private fallback, outside `.next`, auth sessions and reports. The owner record contains the run UUID, local project/container identity, endpoints, checkout and process IDs. Entries contain selectors, acquired fields and lifecycle state; no keys, tokens, passwords or full user rows belong there.
2. Establish the intended local stack and exclusive use. Managed commands cooperate, but direct dev/start, SQL clients and manual QA can bypass them. Do not kill an unknown process or assume a dead coordinator stopped all writers. Docker restart/container identity changes are a target mismatch, not permission to ignore a journal.
3. Read the exact run UUID from that target's `owner.json`, then inspect it from the intended checkout:

   ```text
   node scripts/test-data/recover.mjs inspect <exact-run-uuid>
   ```

   This is read-only. It checks local stack metadata and prints the owner, writer lifetimes and recorded entries. A missing/corrupt record, wrong UUID or inaccessible PID is a blocker, never a stale lock to delete.

## Recover one interrupted run

With local recovery authority and verified exclusive use:

```text
node scripts/test-data/recover.mjs apply <exact-run-uuid>
```

- Recovery refuses a live coordinator, live/uncertain descendant, different stack identity, another live recovery, unresolved outbound request or unrecognized entry. Age is never evidence of abandonment.
- The recovery claim fences further admission. Only after writers are dead and outbound operations have settled can a stranded HTTP handler marker be retired. A rejected/aborted HTTP client alone does not establish that a database operation stopped.
- Exact recorded row intents resolve to IDs; multiple matches or lookup failures remain blocked. Cleanup attempts independent entries in dependency order, restores only acquired fields, deletes Auth users by reconciled owned IDs and verifies results. Successful entries are retired; failures retain enough evidence for a safe retry of this same run.
- Parent/account deletion blocks while application foreign-key dependents remain, including cascade and SET NULL paths. Clean the scope that owns the dependent first; never delete it on behalf of its parent. A failed acquired-field restore also blocks deletion of that row.
- The target becomes available only after all resources/lifecycle evidence are resolved. Re-run the intended normal command after successful recovery; setup does not recover old runs automatically.

An unresolved outbound request needs investigation of its actual local server/database outcome; this CLI has no force/forget option. Unknown legacy leftovers have no ownership proof and require a separate investigation. Never remove a lock/journal, sweep markers, reset data or use hosted as a shortcut. Resetting does not resolve unknown writer lifetime and must not destroy ownership evidence.

## Changing the lifecycle

Keep the subprocess unit probes and real `fixture-recovery.test.ts` probe: two processes/checkouts contend for one target; failed readiness owns no scenario data; closing a scope refuses late HTTP admission; an admitted handler/writer keeps the journal; coordinator death between real writes blocks a contender until explicit recovery; unrelated sentinels survive. The real probe uses a private coordination directory inside the outer exclusive RLS run so its interrupted experiment cannot release the suite's actual lock. It adds no stack and no parallel suite execution.

Journal snapshots and mutations share the metadata gate. Internal readers already holding it do not reacquire it. Published JSON corruption, an interrupted temporary artifact or a gate that cannot be acquired within the bounded wait remains an explicit failure; readers never skip corrupt published state. Keep the independent-process publication/removal regression when changing this protocol.

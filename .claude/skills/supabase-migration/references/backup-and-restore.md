# Backup and restore test of the hosted database

Read this before a hosted write step whose plan requires a backup, and when the Owner asks for a backup or Main is asked to check one. It covers taking a backup of the hosted database and Storage, and restoring it into a scratch local stack to prove it is complete. `SKILL.md` ("Hosted apply") owns the apply steps themselves; `AGENTS.md` section 4 owns who may run what.

## Who does what

| Step | Who | Where |
| --- | --- | --- |
| Dump the database and download Storage (section 1) | The Owner, in their own PowerShell window | Repository root, output outside the repository |
| Read exact hosted counts, the migration list and the hosted service versions, write `hosted.json` (section 3) | Main, under the Owner's grant for that backup | Hosted, counts and metadata only |
| Restore into the scratch stack and compare (section 4) | Main, under the Owner's grant for that backup | Local Docker only |

An implementor runs no hosted command and no step of this runbook that touches a real backup. A reviewer of a backup or of this runbook stays read-only: it reads the files and the result, and runs or edits nothing. No agent takes the dump or the Storage download.

The backup holds personal data and password hashes. Keep it outside the repository and outside `AppData` (the desktop app virtualizes writes there), never paste its content, and delete old backups yourself (Owner decision 9: `%USERPROFILE%\devspace-backups\<yyyymmdd-hhmm>`).

## Folder layout

`backup:check` requires these input files in the backup folder (other files are ignored); a missing one is refused before anything starts.

| File | Written by | Holds |
| --- | --- | --- |
| `roles.sql`, `schema.sql`, `data.sql` | `db dump` (section 1) | Roles, schema, and the data of every schema the CLI dumps (`public`, `auth`, `storage`, ...) as `COPY` blocks |
| `history-schema.sql`, `history.sql` | `db dump --schema supabase_migrations` | The migration history table and its rows. `db dump --data-only` leaves this schema out, so it is dumped on its own |
| `storage/<bucket>/<object name>` | `storage cp -r` (section 1) | One folder per bucket with every object |
| `manifest.json` | the block in section 1 | `time`, `cli` version and the hosted service `versions` |
| `hosted.json` | Main (section 3) | Exact hosted `counts`, the `migrations` versions and the hosted service `versions` |

`backup:check` also writes `check-result.json` (aggregates) and, on a Storage mismatch, `check-mismatches.txt` (object names, the only place they go) into this folder. Every run replaces `check-result.json` with `incomplete` as soon as it holds the run and the Docker checks have passed (a refusal leaves the earlier result alone), so an earlier pass does not stand as the latest result of a run that failed or was killed. One case escapes this: when the runner cannot replace `check-result.json` itself (writing `incomplete` or saving a failed Docker query), it exits 1 and the earlier file may stay unchanged. The exit code and the log of the current run are therefore the result; read `check-result.json` only as that run's output when the run exited 0. The run is released only after the final result is published.

## 1. Take the backup in one paste (Owner)

Where to run it: Windows PowerShell, or a PowerShell tab of Windows Terminal, in the Owner's own window. Not Git Bash or `cmd` (the block is PowerShell), and not the Claude app's Terminal panel or an agent tool (only the Owner runs this dump and download block, and its output stays out of agent sessions; Main's granted reads are section 3). First `cd` to the repository root, the checkout linked to the hosted project, and start Docker Desktop (`db dump` runs in a container).

Paste the whole block once and press Enter. It is a single statement, so PowerShell reads all of it before anything runs and no pasted line can land in a password prompt. If the CLI asks for the database password, type it at that prompt; do not pass `-p` or put it in a variable or file. The block stops at the first command that fails, and the folder it leaves is not a backup: run the whole block again at least a minute later, which starts a new folder (the name has minutes only, and the block refuses a folder that exists). Before any command that reaches the linked project, the block stops when `supabase\.temp\project-ref` is missing, unreadable or names a project other than `lkvxxrxojjlkchzzqidu` (`AGENTS.md`). Section 2 explains its Storage and manifest steps.

```powershell
& {
  $ErrorActionPreference = 'Stop'
  function Invoke-Supabase {
    & npx.cmd supabase @args
    if ($LASTEXITCODE -ne 0) { throw "supabase $($args[0]) $($args[1]) failed (exit $LASTEXITCODE). Stop and report this line." }
  }
  if (-not (Test-Path 'supabase\.temp\project-ref')) { throw 'Run this from the repository root.' }
  $ref = try { (Get-Content -Raw -ErrorAction Stop 'supabase\.temp\project-ref').Trim() } catch { '' }
  if ($ref -ne 'lkvxxrxojjlkchzzqidu') { throw 'supabase\.temp\project-ref is unreadable or names another project. Stop and report this line.' }
  $buckets = @('avatars')
  $remote = @{}
  foreach ($s in (((Invoke-Supabase services -o json) -join "`n") | ConvertFrom-Json)) { $remote[$s.name] = $s.remote }
  $v = @{ postgres = $remote['supabase/postgres']; gotrue = $remote['supabase/gotrue']; storage = $remote['supabase/storage-api'] }
  foreach ($k in 'postgres', 'gotrue', 'storage') { if (-not $v[$k]) { throw "No hosted version for $k. Stop and report this line." } }
  $cli = @(Invoke-Supabase --version)[0]
  if (-not $cli) { throw 'The CLI reported no version. Stop and report this line.' }
  $b = Join-Path $env:USERPROFILE ('devspace-backups\' + (Get-Date -Format 'yyyyMMdd-HHmm'))
  New-Item -ItemType Directory -Path "$b\storage" | Out-Null
  Invoke-Supabase db dump --linked --role-only -f "$b\roles.sql"
  Invoke-Supabase db dump --linked -f "$b\schema.sql"
  Invoke-Supabase db dump --linked --data-only --use-copy -f "$b\data.sql"
  Invoke-Supabase db dump --linked --schema supabase_migrations -f "$b\history-schema.sql"
  Invoke-Supabase db dump --linked --data-only --use-copy --schema supabase_migrations -f "$b\history.sql"
  foreach ($f in 'roles', 'schema', 'data', 'history-schema', 'history') {
    if (-not (Test-Path "$b\$f.sql") -or (Get-Item "$b\$f.sql").Length -eq 0) { throw "$f.sql is missing or empty. Stop and report this line." }
  }
  Write-Host "DUMP FINISHED $(Get-Date -Format 'HH:mm:ss'). Tell Main now: $b" -ForegroundColor Green
  Invoke-Supabase storage ls --linked --experimental
  $dst = Resolve-Path -Relative "$b\storage"
  foreach ($bucket in $buckets) { Invoke-Supabase storage cp -r --linked --experimental "ss:///$bucket" $dst }
  @{ time = (Get-Date).ToString('o'); cli = $cli; versions = $v } |
    ConvertTo-Json -Depth 3 | Set-Content -Encoding utf8 "$b\manifest.json"
  Write-Host "BACKUP FINISHED: $b" -ForegroundColor Green
}
```

The block calls `npx.cmd`, not `npx`. In PowerShell `npx` resolves to npm's `npx.ps1`, which re-parses the text of the calling statement, so `@args` never reaches the CLI: the CLI prints its help and exits 0, and nothing is dumped. The check after the dumps refuses a missing or empty file for the same kind of silent failure.

`--use-copy` writes `COPY` blocks instead of `INSERT` statements, which the check counts. Tell Main the folder as soon as `DUMP FINISHED` prints, without waiting for the Storage download: Main counts right after, and a write to the database between the dump and the count makes check (b) fail (the backup is then retaken and recounted).

## 2. What the block does for Storage and the manifest

The Storage commands are experimental in CLI 2.121.0, so they need `--experimental`. The destination must be an existing folder and a relative path: the CLI reads an absolute Windows path (`C:\...`) as a URL and fails. `Resolve-Path -Relative` gives the relative path from the repository root, so keep the backup on the repository's drive.

`$buckets` must name every bucket the `ls` lists (the app uses `avatars`); a bucket left out fails check (d), and the fix is to add it and take the backup again. The CLI writes the objects to `<backup folder>\storage\<bucket>\<object name>`. A bucket with no objects creates no folder, which is fine.

The `versions` in the manifest are the `remote` column of `npx supabase services`, read before the dumps. The block does not use the checkout's `supabase/.temp` version files: only `supabase link` writes them, so they lag every hosted upgrade.

## 3. Hosted counts and `hosted.json` (Main)

Under the Owner's grant for this backup, and right after the dump, Main reads counts only (Owner decision 12): every `public` table, `auth.users`, `auth.identities` and `storage.objects`, plus the migration list (`npx supabase migration list --linked`, a read-only metadata read) and the hosted service versions (`npx supabase services`, agent-workflow AW-U15 Owner decision 1). No row is read. Before the first of these linked commands Main checks that `supabase/.temp/project-ref` reads `lkvxxrxojjlkchzzqidu`, and stops when it is missing, unreadable or different.

```sql
select tablename from pg_tables where schemaname = 'public' order by 1;
-- then one count per table, in one statement:
select 'public.courses' as t, count(*) from public.courses
union all select 'auth.users', count(*) from auth.users
union all select 'auth.identities', count(*) from auth.identities
union all select 'storage.objects', count(*) from storage.objects;  -- plus every public table
```

Write `hosted.json` into the backup folder (UTF-8, the BOM is tolerated):

```json
{
  "counts": { "public.courses": 6, "auth.users": 3, "auth.identities": 3, "storage.objects": 0 },
  "migrations": ["20261021000000", "20261021131351"],
  "versions": { "postgres": "17.6.1.052", "gotrue": "v2.197.0", "storage": "v1.80.2" }
}
```

`versions` is the `remote` column of `npx supabase services`, read at the same time as the counts: the scratch stack runs these versions, and Storage and Auth create their own tables, so a version older than hosted lacks tables the dump has data for and the import fails with SQLSTATE 42P01. `migrations` is the list of versions `npx supabase migration list --linked` shows in its remote column. `counts` must name every `public` table and the three required ones; the check fails when a restored `public` table is missing from it.

## 4. Restore and compare (Main)

Docker Desktop must be running. Under the Owner's grant for this backup:

```powershell
npm run backup:check -- "$env:USERPROFILE\devspace-backups\<yyyymmdd-hhmm>"
```

It starts the scratch stack (`devspace-backup-check`, ports 56320 to 56329, pinned to the `versions` in `hosted.json`), lets Auth and Storage create their schemas, stops every service, republishes the database port on `127.0.0.1` only, turns server statement and error logging off, confirms the `public` schema is empty, then imports `roles.sql`, `schema.sql`, `data.sql`, `history-schema.sql` and `history.sql` with `ON_ERROR_STOP`. It passes only when all four hold; any difference is a failure, with no explained-difference pass:

- (a) every table in `data.sql` and `history.sql` has a restored count equal to the rows the dump holds;
- (b) every table in `hosted.json` has a restored count equal to the hosted count, and every restored `public` table is named there;
- (c) the restored migration history equals the `migrations` list;
- (d) every `storage.objects` row has a file of the same size (and the same MD5 where the stored ETag is a plain MD5) under `storage/`, and no file lacks a row.

A pass proves only these four comparisons. Equal counts do not prove equal row contents, and an object whose ETag is not a plain MD5 is compared by size only; report the pass with those limits.

Output is aggregates only: table names, counts, totals and pass or fail. A failed step prints its name, exit code and SQLSTATE and nothing from the data; an error while reading the backup (an object or file it cannot open, a JSON or SQL file it cannot parse) prints the step and an error code, never a path or content. The exit code is 0 pass, 1 fail, 2 unresolved (teardown not confirmed, `--teardown` included), 3 refused before anything was written.

A refusal names its cause: a folder inside the repository or under `AppData`, a missing file, a second run or a `--teardown` while another live process holds the run, a container of another project on a scratch port, a Docker engine that is not local. A run that started the scratch stack tears it down, pass or fail, and confirms that no `devspace-backup-check` container, volume or scratch network remains. A run can also end early: a refusal (exit 3) or a failed Docker query or result write before the stack starts (exit 1) creates nothing to remove. Only that teardown confirmation establishes removal: exit code 2 means it is not confirmed, so resources may remain until a `--teardown` run confirms it.

If a run is killed (or the machine shuts down) its run lock and containers stay. The next `backup:check` takes the lock over and removes them first, and says so. To clean up without a new check (refused while a run is live, never tearing it down):

```powershell
npm run backup:check -- --teardown
```

## Reading a failure

| Failed | Likely cause | Next action |
| --- | --- | --- |
| (a) | The import dropped rows (an error masked by a trigger, a constraint) | Treat the backup as unusable; report the table names and counts |
| (b), one table off by a few | A write between the dump and the hosted count | Retake the backup and recount; the Owner may choose a quiet time |
| (b), a restored table not in `hosted.json` | A table was added after Main wrote the counts file | Recount including the table |
| (c) | The history dump is stale or the hosted migration list changed | Retake `history.sql`, recount |
| (d) | A download was interrupted, or an object changed | Redownload that bucket; `check-mismatches.txt` lists the object names |
| A step failed | A role or extension in the dump the scratch stack does not have | Record the SQLSTATE and the statement class as a known exclusion in the owning program's records, only after the Owner agrees (this reference holds no list); an unexplained error fails the drill |

## Not covered

Restoring into hosted, restoring Storage objects into a stack, signing in as a restored user, scheduled or off-site backups, and encryption of the folder are outside this runbook.

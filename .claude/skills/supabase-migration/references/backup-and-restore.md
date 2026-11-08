# Backup and restore test of the hosted database

Read this before a hosted write step whose plan requires a backup, and when the Owner asks for a backup or Main is asked to check one. It covers taking a backup of the hosted database and Storage, and restoring it into a scratch local stack to prove it is complete. `SKILL.md` ("Hosted apply") owns the apply steps themselves; `AGENTS.md` section 4 owns who may run what.

## Who does what

| Step | Who | Where |
| --- | --- | --- |
| Dump the database and download Storage (sections 1 and 2) | The Owner, in their own terminal | Repository root, output outside the repository |
| Read exact hosted counts and the migration list, write `hosted.json` (section 3) | Main, under the Owner's grant for that backup | Hosted, counts only |
| Restore into the scratch stack and compare (section 4) | Main, under the Owner's grant for that backup | Local Docker only |

An implementor runs no hosted command and no step of this runbook that touches a real backup.

The backup holds personal data and password hashes. Keep it outside the repository and outside `AppData` (the desktop app virtualizes writes there), never paste its content, and delete old backups yourself (Owner decision 9: `%USERPROFILE%\devspace-backups\<yyyymmdd-hhmm>`).

## Folder layout

`backup:check` requires exactly these files in the backup folder; a missing one is refused before anything starts.

| File | Written by | Holds |
| --- | --- | --- |
| `roles.sql`, `schema.sql`, `data.sql` | `db dump` (section 1) | Roles, schema, and the data of every schema the CLI dumps (`public`, `auth`, `storage`, ...) as `COPY` blocks |
| `history-schema.sql`, `history.sql` | `db dump --schema supabase_migrations` | The migration history table and its rows. `db dump --data-only` leaves this schema out, so it is dumped on its own |
| `storage/<bucket>/<object name>` | `storage cp -r` (section 2) | One folder per bucket with every object |
| `manifest.json` | the Owner (section 2) | `time`, `cli` version and the hosted service `versions` |
| `hosted.json` | Main (section 3) | Exact hosted `counts`, the `migrations` versions and the hosted service `versions` |

`backup:check` also writes `check-result.json` (aggregates) and, on a Storage mismatch, `check-mismatches.txt` (object names, the only place they go) into this folder.

## 1. Dump the database (Owner)

From the repository root in PowerShell, the checkout linked to the hosted project. The database password is typed at the CLI prompt for each command; do not pass `-p` or put it in a variable or file.

```powershell
$b = Join-Path $env:USERPROFILE ("devspace-backups\" + (Get-Date -Format "yyyyMMdd-HHmm"))
New-Item -ItemType Directory -Path "$b\storage" | Out-Null
npx supabase db dump --linked --role-only -f "$b\roles.sql"
npx supabase db dump --linked -f "$b\schema.sql"
npx supabase db dump --linked --data-only --use-copy -f "$b\data.sql"
npx supabase db dump --linked --schema supabase_migrations -f "$b\history-schema.sql"
npx supabase db dump --linked --data-only --use-copy --schema supabase_migrations -f "$b\history.sql"
```

`--use-copy` writes `COPY` blocks instead of `INSERT` statements, which the check counts. Tell Main the time as soon as the last command ends: Main counts right after, and a write to the database between the dump and the count makes check (b) fail (the backup is then retaken and recounted).

## 2. Download Storage and write the manifest (Owner)

The Storage commands are experimental in CLI 2.121.0, so they need `--experimental`. The destination must be an existing folder and a relative path: the CLI reads an absolute Windows path (`C:\...`) as a URL and fails. `Resolve-Path -Relative` gives the relative path from the repository root, so keep the backup on the repository's drive.

```powershell
npx supabase storage ls --linked --experimental
$dst = Resolve-Path -Relative "$b\storage"
npx supabase storage cp -r --linked --experimental ss:///avatars $dst
```

Repeat the `cp` for every bucket the `ls` lists (the app uses `avatars`). Because `$dst` exists, the CLI writes the objects to `$b\storage\<bucket>\<object name>`. A bucket with no objects creates no folder, which is fine.

```powershell
$v = @{
  postgres = (Get-Content supabase\.temp\postgres-version -Raw).Trim()
  gotrue   = (Get-Content supabase\.temp\gotrue-version -Raw).Trim()
  storage  = (Get-Content supabase\.temp\storage-version -Raw).Trim()
}
@{ time = (Get-Date).ToString("o"); cli = (npx supabase --version | Select-Object -First 1); versions = $v } |
  ConvertTo-Json -Depth 3 | Set-Content -Encoding utf8 "$b\manifest.json"
```

The three version files are the CLI's last record of the hosted service versions. `backup:check` pins the scratch stack to them and refuses a backup whose `hosted.json` names different versions.

## 3. Hosted counts and `hosted.json` (Main)

Under the Owner's grant for this backup, and right after the dump, Main reads counts only (Owner decision 12): every `public` table, `auth.users`, `auth.identities` and `storage.objects`, plus `list_migrations`. No row is read.

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

`migrations` is the list of versions `list_migrations` returns. `counts` must name every `public` table and the three required ones; the check fails when a restored `public` table is missing from it.

## 4. Restore and compare (Main)

Docker Desktop must be running. Under the Owner's grant for this backup:

```bash
npm run backup:check -- C:\Users\<user>\devspace-backups\<yyyymmdd-hhmm>
```

It starts the scratch stack (`devspace-backup-check`, ports 56320 to 56329, pinned to the hosted service versions), lets Auth and Storage create their schemas, stops every service, republishes the database port on `127.0.0.1` only, turns server statement and error logging off, confirms the `public` schema is empty, then imports `roles.sql`, `schema.sql`, `data.sql`, `history-schema.sql` and `history.sql` with `ON_ERROR_STOP`. It passes only when all four hold; any difference is a failure, with no explained-difference pass:

- (a) every table in `data.sql` and `history.sql` has a restored count equal to the rows the dump holds;
- (b) every table in `hosted.json` has a restored count equal to the hosted count, and every restored `public` table is named there;
- (c) the restored migration history equals the `migrations` list;
- (d) every `storage.objects` row has a file of the same size (and the same MD5 where the stored ETag is a plain MD5) under `storage/`, and no file lacks a row.

Output is aggregates only: table names, counts, totals and pass or fail. A failed step prints its name, exit code and SQLSTATE and nothing from the data. The exit code is 0 pass, 1 fail, 2 unresolved (teardown not confirmed), 3 refused before anything was written.

A refusal names its cause: a folder inside the repository or under `AppData`, a missing file, a second run holding the run record, a container of another project on a scratch port, a Docker engine that is not local. After every run, pass or fail, no `devspace-backup-check` container or volume remains.

If a run is killed (or the machine shuts down) its run record and containers stay. The next `backup:check` removes them first and says so. To clean up without a new check:

```powershell
npm run backup:check -- --teardown
```

## Reading a failure

| Failed | Likely cause | Next action |
| --- | --- | --- |
| (a) | The import dropped rows (an error masked by a trigger, a constraint) | Treat the backup as unusable; report the table names and counts |
| (b), one table off by a few | A write between the dump and the hosted count | Retake the backup and recount; the Owner may choose a quiet time |
| (b), a restored table not in `hosted.json` | A table was added after Main wrote the counts file | Recount including the table |
| (c) | The history dump is stale or `list_migrations` changed | Retake `history.sql`, recount |
| (d) | A download was interrupted, or an object changed | Redownload that bucket; `check-mismatches.txt` lists the object names |
| A step failed | A role or extension in the dump the scratch stack does not have | Record the SQLSTATE and the statement class here as a known exclusion only after the Owner agrees; an unexplained error fails the drill |

Known, explained exclusions: none recorded.

## Not covered

Restoring into hosted, restoring Storage objects into a stack, signing in as a restored user (the first drill of that is TM-U9's), scheduled or off-site backups, and encryption of the folder are outside this runbook.

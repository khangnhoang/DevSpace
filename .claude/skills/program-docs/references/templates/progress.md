<!-- Template: progress. Copy to docs/programs/<program>/progress.md, fill every <placeholder>, delete this comment. This is the only place State lives. Edit the State block in place; append one line per milestone. The file has only the sections State and Milestones. -->

# Progress — <program name>

Plan: `plan.md` (an evergreen program: the charter `README.md`). Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | <plan path and revision, e.g. `plan.md` r<n>> |
| Current unit / checkpoint | <unit and checkpoint, or "none active"> |
| Status | <one status, e.g. not started, in progress, blocked, automated checks passed, manual QA pending, merged, completed> |
| Completed evidence | <checks actually run and results, commits; label historical evidence> |
| Accepted deviations | <bounded deviation from the Spec or hypotheses, or "none"> |
| Blockers / Owner decisions | <open blocker or pending Owner decision, or "none"> |
| Next action | <the single next step and who takes it> |
| Current authority | <what is permitted now: implement, commit, push, PR, merge, rollout step; everything else is not granted> |
| Hosted state | <optional, only for programs with a hosted rollout: step reached and where the evidence is> |

## Milestones

One line each, newest last. No review rounds or command logs.

Grammar: `- YYYY-MM-DD <text> (<ref>).` where `<ref>` is a short commit hash (7-40 hex characters, backticks optional), `PR <n>`, `PR <n>, <hash>`, or `this commit`. The final period is optional. At most one milestone cites `(this commit)`, and it is the last one: the next commit that edits this file replaces it with that commit's hash.

- <YYYY-MM-DD> <what happened> (`<commit>`).
- <YYYY-MM-DD> <what happened> (PR <n>, `<commit>`).
- <YYYY-MM-DD> <what happened in this commit> (this commit).

<!-- Template: handoff. Record using the authorized storage binding of the agent environment, one file per task, fill every <placeholder>, and delete this comment. Claude: copy to its memory folder and link from MEMORY.md (.claude/rules.md section 7). A handoff carries exactly one task (docs/agent-loops.md, Handoff) and holds only the facts no doc reflects yet, plus the approved scope of the task it hands over; link to the owning docs instead of copying them. -->

---
name: <task-id>-handoff
description: "Handoff for <program> <task>: <state in a few words>"
metadata:
  type: project
---

Written <YYYY-MM-DD> <at the Owner's request | because the session must stop with work in flight | at the merge of PR n, trimmed to the lagging docs | at the merge of PR n, holding only the lagging docs>. Task: <program> <task>. Delete this file (and, in Claude storage, its `MEMORY.md` line) when <the task's PR n is merged and the owning docs record every durable fact below | the lagging docs below are updated | the catch-up item has moved to a new task's handoff | the Owner cancels the task>; while the task is partly complete, trim it to what is still open and not yet in a doc, and delete it when nothing is left.

**Session facts (expire with the task)**
- Hosted state: <what was applied or checked on hosted, or "none">.
- Git: <branch, `HEAD`, pushed or not, PR number, merged and leftover branches>.
- Running processes: <local stack, dev server, background jobs, or "none">.
- Idle sessions: <session names and ids, or "none">.
- Grants used and pending: <each grant (commit, push, PR, merge, migration apply, CI fixing) as used, open or not asked>.
- Lagging records: <state record and the fact it must hold, or "none">.

**Approved scope**
- <item one: what to do, with a link to the owning doc instead of a copy>.
- <item two>.
- Docs catch-up from PR <n> (only when the previous task's docs lagged at its merge and the Owner asked for this new task's handoff; it moves here once, and the old handoff is deleted in the same turn): <doc and the fact it must record>, one line per doc item.

**Later unit owns**
- <what a later unit or program owns, with a link>.

**After this task**
- <what comes next, or "nothing planned">.

**Prompt for the new session**
- <one line the Owner pastes into the new session>.

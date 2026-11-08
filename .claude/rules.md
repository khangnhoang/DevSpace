# Claude-specific working bindings

Imported directly by `CLAUDE.md`. Shared policy is owned by `AGENTS.md`; lifecycle by `docs/agent-loops.md`; task procedures by skills. This file binds those responsibilities to the Claude environment only.

## 1. Language and UI

Use `AskUserQuestion` for the shared native question-box behavior (`AGENTS.md` sections 1 and 6). Claude wrap-up recaps and buttons use that language policy. Wrap-up buttons are only for a pure yes/no go-ahead (approve, push, merge).

## 2. Roles and sessions

Model and effort choices, including Main's current chat selection, are owned by [agent-models.md](../docs/agent-models.md). The planned-flow implementor binding is:

- Start one implementor session with `start_session`, selecting the model and effort from the table, with `use_worktree: false` unless the plan says otherwise.
- `start_session` caps effort at Main's own, so check with `get_session` and use `set_session_effort` to apply the selected effort before real work. If it cannot be applied, report the blocker.
- Send corrections to that same session with `SendMessage`.

Shared responsibilities, single-writer ownership and review applicability: `AGENTS.md` sections 2–3. These bindings do not assign roles to agents merely by product name.

## 3. Codex reviewer

The existing Codex review workflow stays read-only. Main runs it and decides on findings under `AGENTS.md` section 3; command-level procedure: [codex-brief.md](skills/code-review/references/codex-brief.md).

## 4. Auto-mode denial

- When the auto-mode classifier denies a call, do not work around it. Whoever made the call, Main or an implementor, asks the Owner for that exact action (what, which files, why) with `AskUserQuestion` and retries once after a yes. After a second denial an implementor reports it to Main, and Main reports it to the Owner as a blocker.

## 5. Browser bindings

For manual UI validation in Claude, start the dev server with `preview_start` using `devspace-dev` in `.claude/launch.json` (`npm run dev`, `http://127.0.0.1:3000`). Use `read_page` or `get_page_text` for structure/text; `read_console_messages` and `read_network_requests` for errors and calls; `computer` and `form_input` for interaction; `resize_window` for viewport checks. The shared procedure and its stop/report boundaries are in `frontend-workflow/references/manual-ui-validation.md`.

## 6. Reading skills

To read a skill completely (`AGENTS.md`, rule 6), load it with the `Skill` tool, which loads the whole `SKILL.md`; read a file under its `references/` with `Read`, completely, because the `Skill` tool does not load references. Do not read a skill or a reference through Bash or a partial `Read`.

## 7. Claude memory storage

Information placement and non-authoritative memory principles: `AGENTS.md` section 7. Handoff timing, scope and completion: `docs/agent-loops.md`, Handoff.

Delete a Claude memory line once the owning doc has caught up. When the shared lifecycle calls for a handoff, Main writes one memory file linked from `MEMORY.md`; use [handoff.md](skills/program-docs/references/templates/handoff.md). Deleting a Claude handoff also deletes its `MEMORY.md` line; replacing an old handoff with the next task's catch-up deletes the old file and index line in the same turn. These storage operations apply only to Claude memory, not another agent's personal memory.

## 8. Desktop app file virtualization

On Windows the Claude desktop app runs as an MSIX package, so a file that a Claude process (Main, an implementor, or a tool they start) writes under `%APPDATA%` or `%LOCALAPPDATA%` lands in `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache` and is invisible to the Owner's own shells and programs; a junction into it fails for native programs. Install or configure anything the Owner also uses (a runtime, a version manager, a shared cache) in a folder outside `AppData`, such as `%USERPROFILE%\.<tool>`, and confirm it from the Owner's own shell before relying on it. Files only Claude processes read, such as the scratchpad, may stay under `AppData`.

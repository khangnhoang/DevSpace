# Claude-specific working bindings

Imported directly by `CLAUDE.md`. Shared policy is owned by `AGENTS.md`; lifecycle by `docs/agent-loops.md`; task procedures by skills. This file binds those responsibilities to the Claude environment only.

## 1. Language and UI

Use `AskUserQuestion` for the shared native question-box behavior (`AGENTS.md` sections 1 and 6). Claude wrap-up recaps and buttons use that language policy. Wrap-up buttons are only for a pure yes/no go-ahead (approve, push, merge).

## 2. Roles and sessions

Main is the Opus session. The planned-flow implementor binding is:

- Start one Sonnet session with `start_session`, model `claude-sonnet-5-5`, effort `high`, `use_worktree: false` unless the plan says otherwise.
- `start_session` caps effort at Main's own, so check with `get_session` and fix with `set_session_effort(high)`, ideally before real work.
- Send corrections to that same session with `SendMessage`.

Shared responsibilities, single-writer ownership and review applicability: `AGENTS.md` sections 2–3. These bindings do not assign roles to agents merely by product name.

## 3. Codex reviewer

The existing Codex review workflow stays read-only. Main runs it and decides on findings under `AGENTS.md` section 3; command-level procedure: [codex-brief.md](skills/code-review/references/codex-brief.md).

## 4. Auto-mode denial

- When the auto-mode classifier denies a call, do not work around it. Whoever made the call, Main or an implementor, asks the Owner for that exact action (what, which files, why) with `AskUserQuestion` and retries once after a yes. After a second denial an implementor reports it to Main, and Main reports it to the Owner as a blocker.

## 5. Browser bindings

For manual UI validation in Claude, start the dev server with `preview_start` using `devspace-dev` in `.claude/launch.json` (`npm run dev`, `http://127.0.0.1:3000`). Do not start servers from the shell. Use `read_page` or `get_page_text` for structure/text; `read_console_messages` and `read_network_requests` for errors and calls; `computer` and `form_input` for interaction; `resize_window` for viewport checks. The shared procedure and its stop/report boundaries are in `frontend-workflow/references/manual-ui-validation.md`.

## 7. Claude memory storage

Information placement and non-authoritative memory principles: `AGENTS.md` section 7. Handoff timing, scope and completion: `docs/agent-loops.md`, Handoff.

Delete a Claude memory line once the owning doc has caught up. When the shared lifecycle calls for a handoff, Main writes one memory file linked from `MEMORY.md`; use [handoff.md](skills/program-docs/references/templates/handoff.md). Deleting a Claude handoff also deletes its `MEMORY.md` line; replacing an old handoff with the next task's catch-up deletes the old file and index line in the same turn. These storage operations apply only to Claude memory, not another agent's personal memory.

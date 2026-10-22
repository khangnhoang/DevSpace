# Manual UI validation

Read this before planning, running or reporting manual UI validation. There is no automated browser test and no seeded local data yet, so validation is one deliberate pass in the browser pane, in coordination with the Owner. The matrix itself comes from the plan (`planning`, QA matrix).

## Setup

1. Start the dev server with `preview_start` using the `devspace-dev` entry in `.claude/launch.json` (port 3000). Do not start servers from the shell. Reuse a healthy server and an open tab; do not restart them without a reason.
2. **The Owner signs in.** Agents never type passwords or tokens. Ask the Owner to sign in as the needed role in the pane (learner, enrolled learner, admin) and wait. Use the hosted Supabase data that exists; creating or changing hosted data needs the Owner's approval (`.claude/rules.md` section 4). Never read `.env*`.
3. Define the exact checks first: role and route, the action, the expected result, including what must be denied.

## Run the pass

- Use `read_page` or `get_page_text` for structure and text, not screenshots, unless the question is visual.
- `read_console_messages` for errors and warnings; `read_network_requests` for the calls and their status (an unexpected 4xx or an unfiltered payload is a finding). A paid-content check includes looking at the page data and the network response, not only at what is rendered (P13).
- Toasts (`sonner`) disappear in seconds. To capture one, trigger the action and read the page text or the toast element immediately after, or read the console; report what you saw, and mark it pending if it was missed.
- Drive the interaction with `computer` and `form_input`. Test the primary flow, the destructive flow and its confirmation, loading and failure recovery, empty and long data, and each permission variant.
- Responsive: use `resize_window` for 375px mobile, tablet and desktop (also 320px if no minimum is defined). Check no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`), wrapping text and buttons, table overflow, dialog fit, and tap targets. Reset the size with the desktop preset when finished.
- Keyboard: tab order, visible focus, dialog focus trap and return, labels on icon buttons.

## Limits and report

Stop when the pass would need an account, data or a signed-in role you do not have; do not expand into unrelated visual polish. Respect "no browser QA" or "stop for the Owner's manual QA": report those checks as pending. Do not claim full validation while required checks are pending. Report per check: what was done, what was seen (with the evidence source), pass or fail, and pending items with who must do them.

# Manual UI validation

Read this before planning, running or reporting manual UI validation. The Playwright smoke (`npm run test:e2e`) covers only the paths in `__tests__/e2e`, so validation is still one deliberate pass in the browser pane, in coordination with the Owner. The matrix itself comes from the plan (`planning`, QA matrix).

## Setup

1. Manual QA runs on the seeded local stack: `npx supabase start` if it is down, and `npx supabase db reset` first when the data matters. Reset or stop the stack only after confirming no test run or other pass is using it (it is shared with `npm test` and `npm run test:e2e`; separate stacks are infrastructure FEAT-014).
2. Start the dev server with `preview_start` using the `devspace-dev` entry in `.claude/launch.json` (`npm run dev` on the local stack, `http://127.0.0.1:3000`). Do not start servers from the shell. Reuse a healthy server and an open tab; do not restart them without a reason. Check that `location.origin` is `http://127.0.0.1:3000`.
3. **The Owner signs in** as a `.test` seed user (the users are listed in `CLAUDE.md`, Commands, Local database; the passwords are in `supabase/seed.sql`). Agents never type passwords or tokens: ask the Owner to sign in as the needed role in the pane and wait (`.claude/rules.md` section 4). When the pass needs data the seed lacks, add it to the seed under the rule in [test-quality-strategy](../../test-quality-strategy/SKILL.md) (Test data).
4. Define the exact checks first: role and route, the action, the expected result, including what must be denied.

## What the local stack cannot show

Mail (the dev server uses Gmail placeholders, so a send fails and is logged), real course images (the seed courses have none until FEAT-015, so the UI falls back) and AI features (until the Owner puts a key in the environment file). Check these on a Vercel deployment: the Owner signs in there, a change to hosted data follows `.claude/rules.md` section 4, and until the check is done it is reported pending with the reason. Which database the preview deployments use is not verified, so a preview check counts as hosted.

## Run the pass

- Use `read_page` or `get_page_text` for structure and text, not screenshots, unless the question is visual.
- `read_console_messages` for errors and warnings; `read_network_requests` for the calls and their status (an unexpected 4xx or an unfiltered payload is a finding). A paid-content check includes looking at the page data and the network response, not only at what is rendered (P13).
- Toasts (`sonner`) disappear in seconds. To capture one, trigger the action and read the page text or the toast element immediately after, or read the console; report what you saw, and mark it pending if it was missed.
- Drive the interaction with `computer` and `form_input`. Test the primary flow, the destructive flow and its confirmation, loading and failure recovery, empty and long data, and each permission variant.
- Responsive: use `resize_window` for 375px mobile, tablet and desktop (also 320px if no minimum is defined). Check no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`), wrapping text and buttons, table overflow, dialog fit, and tap targets. Reset the size with the desktop preset when finished.
- Keyboard: tab order, visible focus, dialog focus trap and return, labels on icon buttons.

## Limits and report

Stop when the pass would need an account, data or a signed-in role you do not have; do not expand into unrelated visual polish. Respect "no browser QA" or "stop for the Owner's manual QA": report those checks as pending. Do not claim full validation while required checks are pending. Report per check: what was done, what was seen (with the evidence source), pass or fail, and pending items with who must do them.

# Manual UI validation

Read this before planning, running or reporting the residual manual scenarios selected by [test-quality-strategy](../../test-quality-strategy/SKILL.md#select-checks-from-the-contract), in coordination with the Owner. This reference owns browser mechanics, not test selection. The plan's QA matrix names each manual scenario and its reason; reuse automated evidence and preserve explicit Owner checks.

## Setup

1. Manual QA runs on the dev stack: `npx supabase start` if it is down, and `npx supabase stop` when the pass ends. The test commands use their own test stack and never touch it, so a test run does not erase the pass's data. Data preparation and cleanup follow [test-quality-strategy](../../test-quality-strategy/SKILL.md#test-data); a reset or bulk delete on the dev stack needs the Owner's request, and do not erase another pass's data. Before stopping the stack, confirm no other pass uses it.
2. Start the dev server with the environment's approved preview method (Claude binding: `.claude/rules.md` section 5) (`npm run dev` on the dev stack, `http://127.0.0.1:3000`). Do not start servers from the shell. Reuse a healthy server and an open tab; do not restart them without a reason. Check that `location.origin` is `http://127.0.0.1:3000`.
3. **Sign in** as the needed `.test` seed user (the users are listed in `AGENTS.md`, Commands, Local database; their one shared password is in `supabase/seed.sql`). After step 2's origin check, the agent may type that password into the local login form; no other password or token (`AGENTS.md` section 4). Missing data is planned as stable seed or temporary owned fixtures under [test-quality-strategy](../../test-quality-strategy/SKILL.md#test-data), not automatically added to the shared seed.
4. Define the exact checks first: role and route, the action, the expected result, including what must be denied.

## What the local stack cannot show

Local dev mail uses Gmail placeholders, so a send fails and is logged; seed courses carry no images unless `supabase/seed.sql` adds them. The dev launcher already supports the Owner's AI key from the environment file; missing/expired credentials leave real-provider quality unverified. Agents do not inspect that file (`AGENTS.md` section 4). Guarded E2E uses a placeholder AI key and blocks external calls; it can assert application behavior at controlled boundaries and recorded mail intent, not real delivery/provider quality. Do not infer live access or permission from local configuration.

When acceptance needs live provider/delivery or deployed image checks, name the exact remaining scenario and its authorized environment. For Vercel, the Owner signs in and hosted reads/writes follow `AGENTS.md` section 4; unrun checks remain pending. Which database previews use is unverified, so preview checks count as hosted.

## Run the pass

- Use the supported browser structure/text inspection for structure and text, not screenshots, unless the question is visual.
- Inspect console messages for errors and warnings; inspect network requests for the calls and their status (an unexpected 4xx or an unfiltered payload is a finding). A paid-content check includes looking at the page data and the network response, not only at what is rendered.
- Toasts (`sonner`) disappear in seconds. To capture one, trigger the action and read the page text or the toast element immediately after, or read the console; report what you saw, and mark it pending if it was missed.
- Drive the selected matrix scenarios with supported browser interaction controls. Inspect applicable primary/destructive flows, loading/failure recovery, empty/long data and permission variants without mechanically repeating automated assertions.
- Responsive: use viewport resizing for 375px mobile, tablet and desktop (also 320px if no minimum is defined). Check no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`), wrapping text and buttons, table overflow, dialog fit, and tap targets. Reset the size with the desktop preset when finished.
- Keyboard: tab order, visible focus, dialog focus trap and return, labels on icon buttons.

## Limits and report

Stop when the pass would need an account, data or a signed-in role you do not have; do not expand into unrelated visual polish. Respect "no browser QA" or "stop for the Owner's manual QA": report those checks as pending. Do not claim full validation while required checks are pending. Report per check: what was done, what was seen (with the evidence source), pass or fail, and pending items with who must do them.

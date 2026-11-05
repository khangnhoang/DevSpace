# SE-U2 detail plan — Protect password recovery

Revision: r2, 2026-11-05. Owner approval: 2026-11-05. Charter: [Security Engineering](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: SE-P1 is resolved when a normal session for an account with an existing password cannot replace that password without fresh proof, while a user with a valid recovery email can still reset it.

| ID | Observable result |
| --- | --- |
| AC1 | A signed-out visitor or an ordinarily signed-in user who opens `/auth/reset-password` is directed to the recovery entry point without a password-update request. A spoofed URL or non-recovery PKCE code does not unlock the form. |
| AC2 | A freshly signed-in account with an existing password cannot update it by calling `PUT /auth/v1/user` with a missing, wrong or empty current password. A blank new password cannot clear the old credential. Verify that the old password still works and the proposed one does not. A caller with the correct current password can update through Auth. |
| AC3 | A user who follows the existing email/PKCE recovery link in the requesting browser can submit a valid replacement without the old password. The new password signs in and the old one no longer does. Reload during a valid recovery session works. An expired or reused link is rejected even if a normal session is present. |
| AC4 | If the recovery session is replaced before submit, the form cannot update the other session's account. Keep the current validation, safe failure feedback and duplicate-submit guard for a valid recovery session. |
| AC5 | Record local UI checks, direct Auth API checks with the enforcing setting enabled, and hosted configuration evidence as distinct results. Keep SE-P1 open until the hosted control is active and the approved rollout checks complete. |

### 1.2 Scope and non-goals

- In scope: the existing recovery route, its auth form regression tests, Mailpit capture on the managed test stack, a separate disposable GoTrue test of the native enforcement, and the hosted setting runbook. The existing sign-in screen uses email and password. The production preflight confirms whether there are other active account types before applying this design.
- Out of scope: adding a change-password screen, changing email delivery or cross-browser PKCE (SE-P15/SE-P16), OAuth onboarding, payment work, database migrations, RLS changes and service-role password changes on behalf of users. GoTrue's current-password control applies to existing passwords. First-password enrollment is a distinct operation and any discovered production exposure there requires a scope decision before rollout.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Use GoTrue's server-side current-password requirement at the public Auth endpoint. The app gate uses verified session claims and binds the submit to the recovery session that opened the form. | Browser checks can be bypassed by calling Auth directly, and a session swap can otherwise send the form's password to a different account. |
| G2. Use only genuine Auth sessions in security assertions. Use a fresh normal sign-in, a true PKCE recovery exchange and a local-only mail sink. Use service role for fixture preparation/read-back/cleanup only. | A mock, aged session or privileged actor can make the test pass without exercising the live boundary. |
| G3. Keep the dev stack and the managed test stack independent of the Auth configuration probe. The probe uses run-owned isolated local resources and disposable users, loopback exposure, no outbound mail, and exact cleanup. Stop if these conditions cannot be met. | Replacing or reconfiguring a shared Auth container can change unrelated sessions and invalidate the test evidence. |
| G4. Keep the hosted password minimum above zero. Confirm the exact project and the current-password setting before rollout. | Empty-password behavior or configuration drift could invalidate the intended denial. |
| G5. Capture mail exclusively on the verified `devspace-test` stack. Bind any host-published mailbox endpoint to loopback and keep SMTP on the test project network. Use exact fixture recipients and cleanup selectors. Keep credentials, session state and live recovery URLs out of output and retained traces. | A shared or externally reachable mailbox can leak links, and stale mail can make the wrong test pass. |

### 1.4 Owner decisions that bind this unit

- 2026-11-05: work on SE-P1 on a new branch. Charter decision 2 prioritizes production exposures before migration.
- 2026-11-05: the Owner chose local Mailpit on the managed test stack so standard E2E and CI use actual recovery links for temporary accounts. Outbound SMTP stays out of scope.
- Plan approval and hosted configuration changes are separate grants. The PR #67 documentation catch-up requested on this branch is independent of the auth rollout and should be reviewed as its own diff.

## 2. Repository facts

Baseline: `3d21627a63af6804dec493d756f2fd0a7c7f36c8`, checked 2026-11-05.

- `app/auth/reset-password/page.tsx` calls `getSession()` and then `auth.updateUser({ password })`; existing [AU7] explicitly signs in normally and changes the password. The forgot-password form routes a PKCE code through `app/auth/callback/route.ts`; the callback exchanges it and uses the allowed `next` path.
- `supabase/config.toml` sets a minimum of eight characters and `secure_password_change = false`. The pinned [CLI 2.121.0 Auth service](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/start/services/gotrue.service.ts) wires that setting to the reauthentication flag. It does not wire the current-password flag. The reauthentication flag permits sessions created in the last 24 hours.
- [GoTrue v2.197.0](https://github.com/supabase/auth/blob/v2.197.0/internal/api/user.go), observed on the managed test stack, validates password strength first and separately gates changes to existing passwords with the current-password setting, exempting recovery sessions. Its [recovery handler](https://github.com/supabase/auth/blob/v2.197.0/internal/api/recover.go) sets a recovery authentication method in the PKCE flow state. Hosted settings and runtime version are unverified.
- `scripts/test-stack/config.mjs` excludes Mailpit and sets `[local_smtp].enabled` to false. The existing recovery request E2E row intercepts the mail boundary. The pinned CLI [routes Auth mail to its project Mailpit container](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/start/services/gotrue.service.ts) when local SMTP is enabled and an external SMTP provider is absent. The [Mailpit service](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/start/services/mailpit.service.ts) names the container with the `inbucket` suffix and publishes its web port. The effective bind address is a readiness check.

## 3. Bounded implementation hypotheses

- Keep the recovery form and existing PKCE URL. Use the session's verified authentication method and session identity at the reset route. Treat `next`, client-supplied flags and browser auth event state as untrusted. Use a verified, session-bound access token for the password request so a concurrent browser session change cannot redirect it.
- Reuse existing Auth form controls and submit outcomes. For an invalid session, reuse the established sign-in/forgot-password path and a concise Vietnamese message that tells the user to request a new link. Preserve the form's layout and use no new dependencies.
- Enable the CLI-bundled Mailpit in the generated test workdir, include its actual container name in the test identity/readiness checks, and use the reserved test mailbox UI port (55324) only if loopback-only publication is proven. Reuse the existing test lock, stop and restart commands. Do not publish SMTP or POP3. Request recovery through the normal forgot-password form in a clean browser context. Read the Mailpit API out of band with the fixture helper, wait for the exact reserved recipient, validate the link's test Auth origin before navigation, and follow it in the requesting context. Verify the issued session and reload before updating the route. Delete only fixture-owned mail; mark unresolved cleanup unclean, and scope later mail selection so a stale message can never satisfy a new run. Keep deliberate expired/replay checks tied to the same reserved fixture and exercise them without a long sleep.
- Prove the exact GoTrue configuration against a separate disposable instance of the observed Auth version with a private database and mail sink. Keep the probe small. A fix for the general configuration-restart problem QE-P4 is outside this unit. Use a controlled stop/start under the existing commands to verify the generated Mailpit/SMTP configuration, and verify that a running stack missing the required Mailpit service fails closed or is recreated under the lock.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Prove native Auth enforcement and preserve genuine recovery (AC2, AC3). | Run an isolated API probe against the pinned Auth version with current-password enforcement off and on. Use a normal fresh session to reproduce the issue with the setting off. With it on, verify missing/wrong/blank current password and blank replacement are denied, correct current password succeeds, and the real PKCE recovery path succeeds without it. Verify password persistence by fresh sign-ins. Record flag, image version, results and cleanup. |
| CP2 | Managed E2E harness readiness before route edits. | Prove the Mailpit identity, local-only binding and absence of external SMTP. Through the locked `npm run test:e2e -- auth-forms.spec.ts` path, use a temporary account to request mail, follow the captured link through the real callback, and assert verified recovery claims survive reload. Prove exact user and message cleanup, including a controlled failure, and a second focused run on the retained stack. Run `npm run test:unit -- test-stack-config` for generated config and targeted lifecycle tests for any changed readiness code. Stop before CP3 if the harness needs broader infrastructure or any safety assertion fails. |
| CP3 | Recovery route, regression tests and rollout notes (AC1, AC3–AC5). | Focused `npm run test:e2e -- auth-forms.spec.ts` and `npm run test:unit -- auth-outcomes` if the outcome helper changes. Review the full diff, then run `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`, `npm run build` and `npm run docs:check`. Independent Codex review gates the implementation. |

| Guarantee | Layer and location | Assertion and prerequisites |
| --- | --- | --- |
| AC1 and AC4 | Managed browser E2E, `__tests__/e2e/auth-forms.spec.ts` | [AU8] keeps the signed-out refusal; add an ordinary-session denial and an explicit session-swap case. Verify no update is sent under the wrong session. Use reserved test fixtures, never seed account passwords. |
| AC2 | Local Auth API integration, CP1 probe | Observe endpoint refusal and unchanged credential using a fresh ordinary session with the enforcing flag active. Check the stock behavior separately to establish the control's effect. |
| AC3 and AC4 | Browser E2E and CP1 probe | [AU7] and [AU9] keep validation, same-password feedback, pending and duplicate-submit assertions using the genuine recovery session established in CP2. Cover reload, expiry and replay. The managed browser tests prove the app path with local mail. CP1 proves the same recovery method at the separately configured Auth API. |
| AC5 | Hosted runbook | Configuration read-back, then Owner-authorized verification with a designated account. Evidence is separate from local results. |

| Who | Action | Expected | Prerequisite and reason |
| --- | --- | --- | --- |
| Owner | After an approved rollout, request and use a recovery email for a designated hosted account, then check sign-in. | The email arrives, its link works in the requesting browser and only the new password signs in afterward. | Separate hosted account/write grant. Local mail capture cannot verify the actual provider and deployed redirect. |
| Main | Inspect the existing recovery surface at mobile, tablet and desktop widths after the app change. | Invalid-session guidance is readable, controls have accessible names and focus works. | Approved local browser entry point, appropriate local test data, no shared seed password changes. Perceptual and keyboard check. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Fresh stolen sessions pass the 24-hour check. | Verify the separate current-password flag with a newly issued ordinary session. |
| Hosted recovery differs from the tested version or configuration. | Establish the expected provider, password minimum and recovery settings in preflight. Keep the rollout gated on behavior evidence. |
| First-password enrollment is outside the native requirement. | Verify hosted provider configuration and have the Owner establish whether passwordless accounts are relevant before rollout. Stop for a decision if they are. |
| A recovery link can be reopened, or a different user can sign in in another tab. | Reject replay/expired links and bind the update to the verified recovery session. |
| A retained stack still has the old mail settings or an orphaned message. | Require Mailpit readiness before browser work. Verify a restart and a retained-stack repeat. Look up and remove mail only for the reserved fixture and verify cleanup. |

- Rollout: Main completes local proof and independent diff review. The Owner separately authorizes the hosted preflight, change and designated-account verification. Confirm project `lkvxxrxojjlkchzzqidu`, record the previous setting, and enable **Require current password when updating**. Read the setting back. Verify the currently deployed PKCE path under that setting before delivering the route change, then verify the delivered app through the authorized account. Existing recovery submits omit the current password and must remain valid across the transition.
- Stop when the flag is unavailable, an active account type falls outside the control, CP2 cannot prove the mailbox or recovery session boundary, the target or test isolation is uncertain, or a valid recovery request fails. Pending checks do not resolve SE-P1.
- Rollback: revert the app diff through the normal PR workflow if it breaks recovery. If the Auth setting itself breaks recovery and the Owner grants rollback, restore the recorded previous setting and reopen the exposure in State. A setting rollback cannot undo credential changes already made.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

# SE-U5 detail plan — Public repository readiness

Revision: r3, 2026-11-16. Owner approval: 2026-11-16. Master plan or charter: [charter](../../README.md).

Gated work: the change touches the payment modal, so the Codex gate applies to this plan and to the implementation diff (`AGENTS.md` sections 2 and 3).
## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the source at `HEAD` no longer holds the Owner's bank account number or account-holder name, the payment modal shows the same QR as today from configuration, and the Owner can switch `khangnhoang/DevSpace` to public with its existing history, pull requests and CI logs.

| ID | Observable result |
| --- | --- |
| AC1 | A learner who opens the payment modal on production, with the configuration set, sees a VietQR image for the same bank, account number and account-holder name as before this unit, with the order's amount and transfer content; after a coupon is applied the QR carries the discounted amount. |
| AC2 | A search of every tracked file at `HEAD` for the account number and for the upper-case account-holder name returns no match. |
| AC3 | A learner who opens the payment modal when the bank code, the account number or the account-holder name is missing or blank sees no QR image and a Vietnamese message that payment is temporarily unavailable; "Tôi đã thanh toán" is disabled and "Hủy bỏ" still cancels the order. |
| AC4 | `npm run dev`, the e2e build and the CI build each run with invented placeholder bank values, and no local, e2e or CI run needs a real value. |
| AC5 | The README names the configuration variables a deployment must set, without any value. |
| AC6 | After the Owner switches the repository to public, an anonymous visitor can open the repository, its pull requests and its Actions runs. |

### 1.2 Scope and non-goals

- In scope: reading the bank code, account number and account-holder name of the payment QR from configuration; the missing-configuration state of the modal; placeholder values for dev, e2e and CI; tests for both; the README line; the pre-public read-only checks; the Owner's rollout steps below.
- Non-goals: any rewrite of git history, force-push or change to commit authors (decision 1); the payment actions, pricing, coupons, the transfer-content format and the database; the "Tôi đã thanh toán" flow itself; the open entries TM-P7, TM-P8, TM-P13, TM-P16 and DM-P1, which stay with their programs (decision 4); the name in the footer, which is public by intent; repository settings beyond visibility; the `devspace-app` repository, which the Owner deletes.

### 1.3 Execution guardrails

Only guardrails whose omission causes a concrete failure.

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The Owner sets the three variables on Vercel for Production and Preview before the pull request's preview is used for QA and before the merge. | The production build has no bank configuration, the modal shows the AC3 state and no learner can pay. |
| G2. The change adds no occurrence of the real account number or account-holder name: none in a tracked file of the final tree, a test, fixture, doc, commit message, PR body or agent message. The one place they may show is the removed lines of `CoursePaymentModal.tsx` in the diff itself, which reviewers cite by file and line without quoting the values; searches for AC2 report file names and counts only. Agents never ask for the values and never read them from `.env*`. | The unit puts the values back into the repository it is about to publish, or spreads them into review output. |
| G3. Placeholder values in dev, e2e and CI are plainly invented (an all-zero account number, a name such as `DEVSPACE TEST`). | A realistic placeholder can be scanned and paid to a stranger's account during manual QA. |
| G4. The missing-configuration state never renders a QR built from partial or default values. | A learner pays to an account the Owner does not hold. |
| G5. No command rewrites history or force-pushes on `khangnhoang/DevSpace`. | The 89 pull requests and the commit references in the docs stop matching the history (decision 1). |

### 1.4 Owner decisions that bind this unit

1. (2026-11-16) The original repository `khangnhoang/DevSpace` becomes public with its history as it is. The account number, the account-holder name and the commit author emails that the history holds stay readable; the Owner accepts that. No second public repository is kept.
2. (2026-11-16) The bank account number and the account-holder name are no longer hard-coded: they live in deployment configuration. They may still reach the browser, because the QR must show them.
3. (2026-11-16) The Owner states that the passwords of `admin@devspace.com` and `student@devspace.com` that an old README revision printed (added at `f68cbeb`, removed at `1f13cef`) were already changed on production. No agent verified this, and no agent signs in to check it.
4. (2026-11-16) The open problem entries of other programs stay public as written; none of them blocks the switch (section 2).
5. (2026-11-16) The Owner deletes `khangnhoang/devspace-app` and switches the visibility of `khangnhoang/DevSpace` themself.

6. (2026-11-16) The AC3 state blocks payment and says so, rather than hiding the modal; approved with the plan.
7. (2026-11-16) The configuration is the three public variables `NEXT_PUBLIC_PAYMENT_BANK_CODE`, `NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER` and `NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME`. The Owner set them on Vercel for Production and Preview on 2026-11-16 (rollout step 1), so the names are fixed.

## 2. Repository facts

Only facts that justify a Spec item or expose a conflict. Frozen after approval.

Baseline: `4a41c02`, checked 2026-11-16.

- `app/components/CoursePaymentModal.tsx:41-42` holds the bank code, the account number and the account-holder name in a comment and in the `qrUrl` template; no other tracked file holds the account number — justifies AC2 and the scope.
- The modal is a client component (`"use client"`), rendered only by `app/(main)/course/[slug]/_components/CourseDetailClient.tsx:892` — justifies decision 2's note that the values reach the browser, and the choice between a public variable and a prop in section 3.
- `__tests__/helpers/e2e-env.ts` and `__tests__/helpers/dev-env.ts` build the environment of the e2e and dev servers, and a unit test fails when `app`, `lib` or `proxy.ts` read a variable the e2e map does not set (`test-quality-strategy`, End-to-end) — justifies AC4.
- `.github/workflows/ci.yml:68-69` gives the CI build its public variables as placeholders — justifies AC4.
- The e2e network guard aborts every request to a host other than `127.0.0.1` or `localhost`, so no e2e row loads the VietQR image — justifies testing the QR URL in a unit test and the modal states in a component test, and leaves the real image to Owner QA.
- No component test for `CoursePaymentModal` exists under `__tests__/unit/components/`, and the payment rows of `__tests__/e2e/payment-learner.spec.ts` (PF1, PF3) assert the shown amount and the stored order but never the image URL — justifies the new test file and the extended e2e row in CP1.
- Opening the modal creates a pending order (`CourseDetailClient.tsx:535-537`), and a learner with a pending order cannot open it again (`:530-533`, button disabled at `:821`) — justifies the QA procedure in section 4.
- Main scanned the history on 2026-11-16, before the merged branches were deleted. Method: every added line of `git log --all -p` (all local and remote-tracking refs, lockfile and SVG excluded) matched against patterns for JWTs, `sk-`, `sb_secret_`, `ghp_`, `github_pat_`, `AIza`, `gsk_`, `AKIA`, Slack tokens, private-key headers, database URLs with a password and key-like names assigned a literal of 12 or more characters; the names of every path ever added matched against env, key, dump and archive patterns; every email address, phone-like number and user-profile path listed; pull-request bodies and comments matched against the same patterns. Result within that scope: no key, token or private key, no `.env*` file ever added, and test-only literals for the rest. The pattern set did not cover a password written next to an email in prose, which is how the old README credentials of decision 3 were missed and then found by a search for `@devspace.com`. No dedicated scanner (gitleaks, trufflehog) was run, so the result is "no match for these patterns", not proof of absence — justifies decisions 1 and 3 and the bounded repeat scan in step 7.
- Hosted security advisors read on 2026-11-16 list one `security_definer_view` (`public.profile_cards`), `is_admin()` and `soft_delete_comment` as callable `security definer` functions, `coupons` with RLS and no policy, and leaked-password protection off; none is created or widened by publishing the source, the view is accepted in `docs/programs/security-hotfix/plan-h2.md` and leaked-password protection was dropped as SH-P9 — justifies decision 4. They are not changed here.
- TM-P7 reaches only an enrolled learner, TM-P13 is bounded by RLS and was not reproduced, TM-P8 is a missing redirect, TM-P16 needs a machine on the path between the API and the database, and DM-P1 waits for a Monaco release (`docs/programs/techstack-migration/problems.md`, `docs/programs/dependency-maintenance/problems.md`) — justifies decision 4.
- 128 merged branches were deleted on the remote on 2026-11-16 under the Owner's grant; `main` and `feature/login` remain — context for AC6, nothing left to do.

## 3. Bounded implementation hypotheses

Each names what may change and which Spec or guardrail facts must stay true.

- Each of the three variables of decision 7 is read as a literal `process.env.NEXT_PUBLIC_…` expression so the build inlines it — where the read happens may change if AC1 to AC4, G4 and decision 7 still hold.
- A pure module such as `lib/payment-config.ts` with one function that returns the bank configuration or "not configured", and one that builds the QR URL with each query value encoded — may be shaped differently if the URL and the AC3 decision stay unit-testable without the component.
- The placeholders go into `buildE2eEnv`, the dev map and `ci.yml` — may move if AC4 and G3 hold and the env-map unit test still passes.
- The variable names and the note that they are read at build time go into the README's existing environment section (`README.md:108`, "Môi trường") — may go elsewhere in the README if AC5 holds.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | The modal reads the bank configuration, shows the AC3 state when it is incomplete, and dev, e2e and CI carry placeholders (AC2, AC3, AC4). | Unit rows for the configuration reader (complete, each value missing, blank) and the QR URL (encoded amount, transfer content and name); a component test `__tests__/unit/components/CoursePaymentModal.test.tsx` for the configured state (the rendered image `src` carries the configured bank, account and name with the full amount and the transfer content, and the discounted amount after a faked coupon response) and the AC3 state (no QR, message, disabled confirm, cancel still calls `cancelPayment`), each proven by a mutation; an existing row of `payment-learner.spec.ts` extended to assert that the image `src` in the built app carries the invented placeholder configuration (reading the attribute, with no exception to the network guard); `npm run test:unit`; `npx tsc --noEmit`; `npm run lint`; `npm run test:e2e -- payment-learner` for the modal rows; a `git grep -c` for AC2 that prints counts only (G2). |
| CP2 | The README names the variables (AC5) and State records the unit. | `npm run docs:check`. |
| Final | Whole diff after review corrections. | `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run docs:check`; Codex gate on the diff. |

Manual QA, with the reason each stays manual:

- AC1, on the preview and again on production (a real external image and the Owner's own account, which no agent may hold). Readiness: the Owner confirms which database the deployment uses, and signs in as a learner who has neither an enrollment nor a pending order on one paid course. Steps: open the modal (this creates one pending order), scan the QR without paying, compare bank, account, account-holder name, amount and transfer content with what the banking app shows, then press "Hủy bỏ", which sets that order to failed. The failed order stays as a record, as in the SE-U1 production QA. When the preview and production share a database, the cancel on the preview is what lets the same learner repeat the steps on production. If no such learner and course exist, the QA is blocked and the Owner names the account to use.
- AC6: the Owner opens the repository signed out after the switch (a GitHub setting).

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A variable is missing or misspelled on Vercel, so production shows the AC3 state. | G1; the preview QA in step 3 exposes it before the merge; the state blocks payment instead of showing a wrong QR (G4). |
| A typo in the account number sends money to another account. | The Owner's scan on the preview and on production (AC1), compared with the current QR. |
| Publishing cannot be undone: clones, forks and caches keep the history after a switch back to private. | Decision 1 is explicit; steps 6 and 7 run before the switch. |
| The Owner's statement in decision 3 is wrong and an old password still works. | The Owner re-checks both accounts in step 6; these are the known historical production passwords that Main identified. |
| A fork's pull request triggers a Vercel preview or a workflow with access the Owner did not intend. | Step 7: the Owner checks the Vercel setting for forked pull requests and the Actions approval setting. CI uses no hosted secret. |

- Rollout runbook (Owner or hosted steps, in order):
  1. Owner: set the three variables on Vercel for Production and Preview (G1).
  2. Main: push and open the pull request under the Owner's grants; CI; Codex gate on the diff.
  3. Owner: QA on the preview (section 4, AC1; the AC3 state is covered by tests). A value corrected on Vercel takes effect only in a new build, so after a correction the Owner triggers a new preview build before repeating the QA.
  4. Owner: merge; production deploys; Owner repeats the QA on production (AC1). If it fails, the rollout stops here: nothing is published until a corrected production build passes the QA.
  5. Owner: delete `khangnhoang/devspace-app` (decision 5).
  6. Owner: confirm that the two `@devspace.com` passwords of decision 3 no longer work, and tell the two other commit authors that their commit emails become public.
  7. Main, read-only: repeat the scan of section 2 with the same patterns plus "an email followed by a password in prose" on every ref the remote then holds, run the AC2 search on the merged `main`, list remote branches, and report matches by file and commit without printing a value. The same limits apply: a pattern scan, not proof of absence. Owner: check the Vercel and Actions settings for forked pull requests.
  8. Owner: switch `khangnhoang/DevSpace` to public; check AC6 signed out.
  9. Main: record the milestone and close the unit in State.
- Stop when: a real bank value appears anywhere G2 forbids (an added line, a log, a message); CP1 cannot show the AC3 state without a partial QR (G4); the step 7 scan finds a credential that decision 3 does not cover; a Vercel variable cannot be confirmed before the merge.
- Rollback: a configuration fault is fixed in configuration (correct the Vercel values, new build), which keeps AC2. Reverting the pull request restores the hard-coded values to the tracked tree, so it is an exception to G2 that needs the Owner's decision and is not available once the repository is public without accepting them at `HEAD` again. The visibility switch is undone by switching back to private; that recalls no copy someone already took.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

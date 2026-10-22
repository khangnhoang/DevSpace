# Uploads, payments and external callbacks

Read this when an action reads or writes a file, a Storage path, a payment or coupon, an email link or an external callback. The core rules are in `SKILL.md`.

## Uploads

- Check on the server: a file is present; content type and extension match what is allowed; size is within the limit; the caller may write there.
- Never trust the client's bucket, file name or path. Generate the path on the server (for example under the caller's user id) for anything sensitive. A policy that lets any signed-in user write any path is a known gap (P10); do not rely on it.
- Declared name, extension, MIME type and size do not prove the contents. Say so in the report when content inspection is out of scope.
- Return a short generic error; keep the provider's error server-side.

## Payments and coupons

- The price, discount and final amount come from the database rows on the server, never from the request.
- A coupon's validity (active, within dates, usage limit) is checked on the server in the same operation that uses it. The client-side coupon check in the payment modal is only UX. Usage counts and reservations are race-sensitive: see `supabase-migration` (RPC and concurrency) before changing how they are counted (P5, P6).
- Approving or rejecting an order checks the current status in the write and changes the enrollment together with it (P25). Do not run the same transition twice.
- Do not update payment or enrollment state from an unverified event. Do not log whole payment payloads or secrets.

## Email links and external callbacks

- Treat the link or callback parameters as untrusted. Validate redirect targets (`lib/safe-next-path.ts`) instead of redirecting to a raw `next` value.
- Check the authenticity of anything that claims to come from a provider before acting on it, and make processing idempotent so a retried callback is harmless.
- Auth link behavior (PKCE, `token_hash`) is tracked in the problems list (P14, P18); do not change it inside an unrelated task.

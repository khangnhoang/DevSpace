# Pages that read through the API

Read this when a page, layout or server component reads data from the NestJS API (`backend/`) instead of a Supabase client. Skip it for a page that still reads with the Supabase clients or a server action. The `/learn` pages (`lib/learn.server.ts`, `lib/learn-api.ts`) are the working example; read them before writing the next one.

## Where the call sits

- One server-only function per route, in `lib/<area>.server.ts` (`import "server-only"`), calls `apiFetch` from `lib/api.server.ts`, the only place Next code reaches the API. A page never calls `fetch`, never reads `API_INTERNAL_URL` and never calls the API from client code: the browser reaches `/api/*` only through the `proxy.ts` rewrite.
- The pure part lives in a module with no Next, React or Supabase import (`lib/<area>-api.ts`): the response schemas, the mapping of a response to a result and the helper that escapes a query value. A unit test imports it and fakes the call, so it needs no server and no DOM.
- Parse every 200 body with a Zod schema before use. A body that does not match is an outage, never data guessed from a shape. Response schemas are not request schemas, so they stay beside the server functions, not in `lib/schemas/`; the route's query schema is the one in `lib/schemas/` that the controller also uses ([server-actions](../../server-actions/SKILL.md), Nest endpoints).
- Start a function with `await connection()` and pass `unstable_rethrow` to the mapper, so the signal Next throws to mark a render dynamic is not swallowed as an outage. Wrap a function that several segments of one render call (a layout and its page) in `React.cache`, so the render makes one API call.

## How a refusal or a failure reaches the page

The API owns the decision; the page only maps the answer.

| API answer | Result | The page |
| --- | --- | --- |
| 200 that matches its schema | data | renders |
| 401 | unauthenticated | `redirect("/login")` |
| 403 | forbidden | `redirect` to the page that explains or sells access |
| 404 | missing | the not-found screen of that page, not `notFound()` unless the page already used it |
| 5xx, a network error, a redirect, a 200 of the wrong shape | unavailable | a message, no content and **no redirect** |

- An outage is never a redirect: a broken API must not read as "not signed in" or "not enrolled". Log the status or the error's type only, never the body, a cookie or a field of the answer.
- A layout decides nothing about access. It renders what a 200 gives (a sidebar) and leaves the part out on any other answer, because the page of the same render redirects or shows its own state. A layout is not re-rendered on client navigation, so an access check there is no gate.
- Keep one read per concern. A read whose failure should not take the page down (a sidebar) is a separate route from the page's own read; do not fold them into one answer only to save a call.

## What a test fakes

- A unit row passes the mapper a function that returns a `Response` or rejects, and asserts each row of the table above, that an unreachable API is unavailable, and that the log holds no body or cookie.
- An `api` row calls the route with minted sessions and asserts the order of the refusals and that no private field is in a refusal body ([test-quality-strategy](../../test-quality-strategy/SKILL.md), API tests).
- An e2e row drives the page. To fail one route while the others answer, use a cookie that the e2e API build alone honors (`backend/e2e/main.ts`); the Next server forwards the visitor's cookies, which is the only way to fail a server-side read from a browser row. The API's request record (`serverRecords.apiCalls()`) shows which calls a render made, and that it made no non-GET call. Nothing in the production build reads the cookie.

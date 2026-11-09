import { apiFetch } from "@/lib/api.server";
import { fixturePost } from "./fixture-actions";

// Test fixture of TM-U3 (AC20). `.e2e.tsx` is a page extension only in the e2e build (next.config.ts), so this route and
// its action are in no production build. It is how the e2e suite proves the rewrite, the helper's
// Origin and the cross-origin refusal of a server action against the real API, whatever that API serves by then.
export const dynamic = "force-dynamic";

export default async function E2eFixturePage() {
  const response = await apiFetch("/api/e2e/whoami");
  await response.arrayBuffer();
  return (
    <main>
      <p>whoami: {response.status}</p>
      <form
        action={async () => {
          "use server";
          await fixturePost();
        }}
      >
        <button type="submit">post</button>
      </form>
    </main>
  );
}

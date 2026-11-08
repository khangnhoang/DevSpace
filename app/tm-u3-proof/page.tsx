import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api.server";

// Temporary proof surface of TM-U3 (plan 1.2), removed by PR 2. It exists to show the session reaching the API through
// the helper, and it is 404 whenever the API says 404 for it: the API's flag and its owner check decide, not this page.
// A render makes GET calls only. It prints statuses and `ok`, never a user id, a token or a row.
// The body is read and dropped, not cancelled: Next memoizes a GET fetch during a render through a cloned stream, and
// cancelling one branch of it never settles.
export const dynamic = "force-dynamic";

const CALLS = [
  ["session", "/api/session"],
  ["session-cold", "/api/proof/session-cold"],
  ["read", "/api/proof/read"],
] as const;

export default async function TmU3ProofPage() {
  // The flag comes first, so the page is 404 with no API call whenever the Owner has not set it (or has removed it at
  // the end of the proof), and also before the API's address is configured. The API's own 404 still ends the page.
  if (process.env.API_PROOF_ENABLED !== "1") notFound();
  const results: { name: string; status: number }[] = [];
  for (const [name, path] of CALLS) {
    const response = await apiFetch(path);
    await response.arrayBuffer();
    if (response.status === 404) notFound();
    results.push({ name, status: response.status });
  }
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">TM-U3 proof</h1>
      <ul>
        {results.map(({ name, status }) => (
          <li key={name}>
            {name}: {status}
          </li>
        ))}
      </ul>
    </main>
  );
}

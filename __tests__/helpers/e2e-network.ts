export type RequestVerdict = "allow" | "abort" | "hosted";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function isHostedHost(hostname: string): boolean {
  return (
    hostname === "supabase.co" || hostname.endsWith(".supabase.co") || hostname === "devspace-lms.vercel.app"
  );
}

function verdictForHost(hostname: string): RequestVerdict {
  if (LOCAL_HOSTS.has(hostname)) return "allow";
  return isHostedHost(hostname) ? "hosted" : "abort";
}

// The `url` parameter of `/_next/image` that is an absolute URL (or protocol-relative, which a browser also
// resolves against another host) names a host the Next server would fetch. A relative value is a local file.
function imageSourceVerdict(source: string): RequestVerdict {
  const cleaned = source.replace(/[\t\n\r]/g, "").trim().replace(/\\/g, "/");
  let target: URL;
  try {
    target = new URL(cleaned.startsWith("//") ? `http:${cleaned}` : cleaned);
  } catch {
    return "allow";
  }
  return verdictForHost(target.hostname);
}

// "allow": the request may go out. "abort": a non-local host, aborted. "hosted": aimed at the hosted Supabase
// project or the production site; aborted, and the test that made it fails. Anything that cannot be parsed is
// aborted, so the guard fails closed.
export function classifyRequest(rawUrl: string): RequestVerdict {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "abort";
  }
  // These schemes never leave the browser.
  if (url.protocol === "data:" || url.protocol === "blob:" || url.protocol === "about:") return "allow";

  const own = verdictForHost(url.hostname);
  if (own !== "allow") return own;

  if (url.pathname === "/_next/image") {
    const source = url.searchParams.get("url");
    if (source !== null) return imageSourceVerdict(source);
  }
  return "allow";
}

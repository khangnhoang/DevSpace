const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

type LocalStorageImages = {
  remotePatterns: {
    protocol: "http" | "https";
    hostname: string;
    port: string;
    pathname: string;
  }[];
  dangerouslyAllowLocalIP?: true;
};

// `next/image` renders only hosts listed in `images.remotePatterns`, so an avatar stored on a local Supabase stack needs
// its Storage path listed. It is listed only when the configured Supabase URL is local: on a hosted build the same entry
// plus `dangerouslyAllowLocalIP` would let the image optimizer fetch the server's own localhost. The optimizer refuses
// a private address unless that flag is set, so a local build needs both. A missing or unparsable URL adds nothing.
export function localStorageImages(
  supabaseUrl: string | undefined,
): LocalStorageImages {
  if (!supabaseUrl) return { remotePatterns: [] };
  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return { remotePatterns: [] };
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !LOCAL_HOSTS.has(url.hostname)
  ) {
    return { remotePatterns: [] };
  }
  return {
    remotePatterns: [
      {
        protocol: url.protocol === "https:" ? "https" : "http",
        hostname: url.hostname,
        port: url.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    dangerouslyAllowLocalIP: true,
  };
}

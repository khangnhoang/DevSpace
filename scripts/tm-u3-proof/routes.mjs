// The temporary surfaces of TM-U3 (plan 1.2), removed by PR 2. One list, used by verify mode (every one must be
// absent) and by the api test that keeps this list equal to what the API registers with the flag on.
export const API_TEMPORARY_ROUTES = [
  { method: "GET", path: "/api/session" },
  { method: "GET", path: "/api/proof/session-cold" },
  { method: "GET", path: "/api/proof/read" },
  { method: "POST", path: "/api/proof/echo" },
  { method: "POST", path: "/api/proof/upload" },
  { method: "GET", path: "/api/proof/slow" },
  { method: "GET", path: "/api/proof/stream" },
];

// The page of the Next app that is 404 whenever the API answers it 404.
export const APP_TEMPORARY_PAGES = ["/tm-u3-proof"];

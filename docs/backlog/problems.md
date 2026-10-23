# Problems, risks and follow-ups — backlog

Problems that no open program owns. This is not a program: it has no plan and no progress.

## Open

### BL-002: `next/image` optimizes images from any HTTPS host

- Status: Open (2026-10-23).
- Problem: `images.remotePatterns` in `next.config.ts` ends with `hostname: '**'`, so `/_next/image` fetches and optimizes an image from any HTTPS host. On Vercel anyone can spend the project's image-optimization quota through DevSpace's domain; self-hosted, an open pattern is the precondition of image-optimizer advisories such as GHSA-9g9p-9gw9-jx7f.
- Evidence: `next.config.ts` on `adb3262`; found while reading the `next` advisories for infrastructure INF-001.
- Direction: list the hosts the content really uses (Supabase Storage and the course image hosts already named in the file) after checking the stored image URLs, then drop `**`. Small task once the host list is confirmed.
- Exit condition: `remotePatterns` names only explicit hosts, and every course image and avatar still loads.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-002 — Moved to [agent-workflow](../programs/agent-workflow/problems.md)
- BL-001 — Done: the docs checker treats a `Moved to` line as a pointer and the moved FEAT entries use the template lines again (PR #8)

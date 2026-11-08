<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## LAFLAMME storefront rules

- Two root layouts via route groups: `src/app/(site)` is the public shop (`<html lang="ru">`), `src/app/(payload)` is Payload CMS (admin at `/cms`, REST at `/api`). Do not add `src/app/layout.tsx`.
- `cacheComponents` is on. Fetch Medusa/Payload data in server-only functions marked `"use cache"` with `cacheTag(...)`; invalidate with `revalidateTag` from webhooks. Never read cookies/headers inside a cached scope.
- URL scheme, redirects, meta, JSON-LD and robots rules: `docs/TZ.md`, п. 7. Indexable content must be in the server HTML.
- Styling: Tailwind v4, tokens in `src/app/(site)/globals.css`. Mobile-first (375 px).
- Code style: no semicolons, double quotes, 2-space indent (same as backend).

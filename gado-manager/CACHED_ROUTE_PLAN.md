# GadoManager — caching + hardening state snapshot

This is a machine-readable-ish snapshot of where the web app stands after the
v0.9→1.0 pass. It exists so we do not re-derive the same conclusions from
rummaging through source every time.

## Status of “every page loads every time”

Responsive pages are now split into three buckets.

### 1. Pages that use the stale-while-revalidate cache hook
These do not fully re-fetch on every navigation. They use
`src/lib/use-cached-data.ts` and key-based invalidation in mutations.

- `src/app/page.tsx` — dashboard
- `src/app/animals/page.tsx` — animal list
- `src/app/animals/[id]/page.tsx` — animal detail
- `src/app/animals/[id]/history/page.tsx` — animal history (reuses detail cache key)

### 2. Pages that use `fetch` in `useEffect` only
The navigation is client-side (Next `<Link>` already does that), so the
“reload every time” complaint is not actually from these pages talking to the
server again and again. But they still do not opportunistically reuse data
between visits, and some of them had their own cracks (null-handling, refresh
loops, raw-route 404s).

- `src/app/reports/page.tsx` — general report
  - known runtime crack: `report.menorGanho !== 0` guard before calling
    `.toFixed()` on a nullable field — fixed in this session
- `src/app/animals/[id]/report/page.tsx` — animal report
- `src/app/farms/join/page.tsx`
- `src/app/farms/members/page.tsx`
- `src/app/farms/requests/page.tsx`

### 3. Pages that are intentionally light or server/data-driven
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/app/animals/new/page.tsx`

These are mostly form/action pages; the main thing that mattered there was the
auth navigation behavior.

## Concrete breaks fixed in this session

1. `src/app/reports/page.tsx`
   - `report.menorGanho !== 0` → now also checks `report.menorGanho !== null`
     before `.toFixed(1)`. There are two occurrences: one in the PDF table data
     and one in the “Menor Ganho” card.

2. Auth navigation
   - `src/app/login/page.tsx` post-login flow no longer does a
     `router.push("/")` then `router.refresh()`. It uses `router.replace("/")`
     instead. This removes one class of dashboard reload loops.

3. Whole-site 404 behavior
   - `src/app/not-found.tsx` now exists, so missing routes render a friendly
     404 instead of a raw route not-found error page.

4. Global app error boundary
   - `src/app/error.tsx` now exists. Unhandled client errors render a friendly
     error page with a retry action instead of a raw crash screen.

Not applied this session, but explicitly left as a known gap:

- The farms pages and `reports/*` pages still only use `fetch` in `useEffect`.
  They were not converted to the cache hook in this session.
- `src/app/animals/[id]/report/page.tsx` was not fully re-read; it may still
  have similar nullable numeric rendering cracks.

## Hardening markers

- Global error pages added: `src/app/not-found.tsx`, `src/app/error.tsx`.
- Small unauthenticated contract still inconsistent in access patterns: some
  routes rely on middleware redirect, some return JSON errors, some would throw
  to the top. This is acceptable for the size of the app but is still a
  refinement item for a true 1.0.
- Bare `catch {` blocks were left in a few config/health/switch routes as
  defensive handlers. They are not a major concern here but are still slightly
  nonce code.

## How to verify quickly

1. `npx tsc --noEmit` should pass.
2. `npm run lint` should be clean of errors (the one remaining warning is
   pre-existing and unrelated to this session work).
3. `npm run build` should succeed.
4. The reports page should no longer crash with
   `Cannot read properties of null (reading 'toFixed')` coming from the
   “Menor Ganho” logic.
5. Missing routes should now render the new 404 page instead of a blank/raw
   error.
6. Login should go to the dashboard without a refresh loop on success.

## Outstanding items for a real 1.0

- Add the cache hook to the farms routes and at least the general report page.
- Add a lightweight e2e/smoke test hitting: login → dashboard → animals → animal
  detail → reports, plus auth failure and 404 cases.
- Normalize the route error contract so the frontend can rely on consistent
  `error` shapes and the app has fewer “some routes swallow, some crash” cases.
- Clean up experimental duplicate artifacts in the repo root if any remain
  (database/, flutter_app/, batch scripts) so the canonical app boundary is
  obvious to a reviewer.

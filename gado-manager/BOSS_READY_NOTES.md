# GadoManager — v0.9 → v1.0 status notes

Short version: the core app is solid enough to show, but it is not yet a
polished 1.0. The good parts are real; the remaining work is mostly
robustness, not missing features.

## What is already good

- Real, usable product surface: dashboard, animal list, animal detail, history,
  reports, farm membership/requests, and a separate offline-capable mobile app
  and automation bots.
- Backend is structured like a real app: services, route handlers, owned
  operations in transactions, and ownership checks (`userCanWriteToFarm`,
  `animalBelongsToFarm`).
- Security work is ahead of many projects at this size: rate limiting on login
  and register, input sanitization, cookie-based sessions, and an audit-style
  notes file exists.
- Good coverage of the core calculations already exists, with targeted tests.

## What was fixed in this pass

- Reports page no longer crashes with
  `Cannot read properties of null (reading 'toFixed')` in the “Menor Ganho”
  rendering — fixed null guard in both places.
- Login no longer triggers a post-login dashboard refresh loop — switched from
  `router.push("/")` + `router.refresh()` to `router.replace("/")`.
- Missing routes now render a friendly 404 page instead of a raw route error.
- Unhandled client errors now render a friendly error boundary with a retry
  action instead of a raw crash screen.

## What still needs to be done before calling it a 1.0

1. Add caching to the remaining uncached UI pages, especially the farms routes
   and at least the general report page, so no path still re-fetches on every
   navigation.
2. Normalize the route error contract. Right now some routes return JSON errors,
   some rely on redirects, and some would throw to the top. Frontend should be
   able to depend on consistent error shapes.
3. Add a small smoke/e2e layer covering the main flows:
   - login → dashboard → animals → animal detail → reports
   - login failure
   - missing route behavior
4. Clean up the repo boundary so a reviewer can see what is canonical without
   second-guessing experiments, scripts, and legacy copies.

## Quick verification checklist

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Reports page no longer crashes on the “Menor Ganho” card
- Login lands on the dashboard without a refresh loop
- Missing routes render the friendly 404 page
- Unhandled client errors render a friendly error page with retry

## How to present it

Lead with scope and structure, not with the bugs. Show:
- what exists,
- how it is organized,
- that the backend has ownership and transaction discipline,
- that auth has rate limiting and session handling,
- and then say the gaps are robustness-oriented and narrowing.

That framing is honest and accurate for where this actually stands.

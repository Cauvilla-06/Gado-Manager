# SKILL.md

Use this skill when working inside this project.

## Project overview
This is a Next.js + TypeScript web app with a Flutter mobile app and PowerShell
automation bots for managing cattle data. The repo also has a separate
`flutter_app/` directory and several automation test scripts.

## Before coding
- Prefer making the smallest change that fixes the reported issue.
- If the issue touches navigation, check whether the page uses the cache hook
  in `src/lib/use-cached-data.ts` or still does raw `fetch` in `useEffect`.
- When touching API routes, keep error handling consistent: always return a
  JSON error response for expected failures.
- Try not to introduce new bare `catch { }` blocks in new code unless there is
  a clear reason.

## Common verification commands
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm test`

## Notes on this workspace
- The repo contains unrelated directories at the same level as this project
  root. Do not treat sibling directories as part of the current app unless the
  task explicitly says so.
- Do not commit local-only files such as `.env`, local config, database files,
  or IDE folders.
- Keep the canonical app boundary clear. Do not scatter work into duplicate
  copies of the same app.

# talley_app

A.E. Talley Construction field board — a Monday.com-style job tracker built
mobile-first, so the same codebase runs in the browser today, in Bluestacks as an
Android app, and as an iPhone app once it is wrapped.

Built around the A.E. Talley logo and palette: burgundy `#6D2431`, steel grey
`#808080`, warm sand surfaces and white.

## What it does

- **Projects** — every active job with contract value, completion and a blocked
  count, searchable by job, owner or street.
- **Board** — per-job scopes (Pre-Construction, Site & Foundation, MEP Rough-In…)
  with task cards showing status, owner, due date and committed cost. Tap a card
  to edit it, or add tasks directly to a scope.
- **Crew** — who is on the job, their role, phone number and open/blocked load.
- **Overview** — portfolio contract value, committed cost, workflow breakdown and
  what is due in the next ten days.
- Each board keeps a running activity log (task added, moved to blocked, removed).

## Layout

```
backend/            FastAPI + SQLite API (seeded with real-looking jobs)
  app/db.py         schema + demo data
  app/main.py       REST endpoints under /api
frontend/           React + Vite + Tailwind mobile app
  src/pages/        Projects, Board, Crew, Overview
  src/components/   sheets, cards, pills, nav, logo
  capacitor.config.ts  native shell config for iOS/Android
```

## Run it

Compose is managed outside this repository by the Base44 environment
(`docker compose --project-name app ... up -d`). Locally, with the two services
defined there:

- web app: <http://localhost:3000> (Vite dev server, hot reload, proxies `/api`)
- API: <http://localhost:8000/api/health> and docs at `/docs`
- SQLite data lives in the `api_data` volume at `/data/talley.db`

The board seeds itself on first boot, so a fresh database is never empty.

## Putting it on a phone

The frontend already has the Capacitor shell configured (`appId
com.aetalley.fieldboard`). The native apps talk to a deployed API, so build the
web bundle with the API URL baked in:

```bash
cd frontend
VITE_API_URL=https://your-api-host npm run build

# Android (works with Bluestacks)
npx cap add android
npx cap sync android
npx cap open android        # build the APK in Android Studio, then drag it onto Bluestacks

# iOS (needs a Mac with Xcode and an Apple developer account)
npx cap add ios
npx cap sync ios
npx cap open ios            # set the signing team, then run on a device
```

Before shipping to the App Store, replace `public/icon.svg` with the exported
1024×1024 PNG icon and add the splash screen (`@capacitor/assets`).

## Notes

- `BASE44_PREVIEW_MODE=1` is only used to add the sandbox host to Vite's allowed
  hosts and to enable the file watcher in a container; unset, Vite behaves
  normally.
- Statuses are fixed (Not Started, In Progress, Blocked, Review, Done) so that
  the field crews see the same five colours on every job.

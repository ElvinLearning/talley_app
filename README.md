# A E Talley Construction — estimating & field workspace

Built by Cozy Digital. A single-company, **local synthetic-data demo** that extends
the existing React/Vite/Tailwind + FastAPI/SQLite field board.

Start with **Jobs**: customer → job → estimate → recorded approval → project →
assigned tasks → field status update.

## What is in the workspace

| Screen | Address | What it is for |
| --- | --- | --- |
| Jobs | `#/jobs` | The sheet of every job: stage, next step, owner, due date and value. Filter by stage or "Needs attention" (blocked, overdue or unowned), search, sort, and change a stage in place. |
| Job | `#/jobs/12` | One page per job: next step with its action, customer contact, scope, estimates and revisions, the task sheet (owner, due date and status edit in place), approved budget, crew access and activity. |
| Estimate | `#/jobs/12/estimates/7` | Sections and lines as a sheet. Your cost, markup, selling price and tax stay in view. Field-level validation, Ctrl/⌘+S, "Add from past estimates" (your own saved prices; nothing is generated). |
| Client estimate | `#/jobs/12/estimates/7/preview` | The letter-size document the customer gets. Selling prices only. Print / save PDF. |
| Field crew | `#/` and `#/work/5` | My jobs → my tasks → status, note, save. No prices are ever sent to a crew account. |
| Crew, Overview | `#/crew`, `#/overview` | Who owns what; what is due in the next ten days. Project boards started without an estimate are under Overview → All project boards. |

Every screen has its own address, so refresh, the browser's back button and the
phone's back gesture work. Unsaved estimate or field changes ask before leaving.
If a session ends mid-task, sign-in appears over the screen and the work is kept.

## Run locally on Windows

Requirements: Python 3.12+, Node 22+ and npm. These commands run from the repository root.
If Python is managed by uv, use `uv venv --python 3.12 .venv` instead of the first command.
For a uv-created environment without pip, install with
`uv pip install --python .venv/Scripts/python.exe -r backend/requirements-dev.txt`.

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci

# Choose a local demo password of at least 12 characters; do not commit it.
$env:TALLEY_DEMO_PASSWORD = Read-Host 'Local demo password'
$env:DEMO_MODE = '1'
$env:COOKIE_SECURE = '0'  # local HTTP only; secure cookies are the default
Set-Location backend
../.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal, from the repository root:

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1
```

Open **http://127.0.0.1:5173**. Demo usernames:

- `admin.demo` — customer/job/estimate/project administration and financial data.
- `worker.demo` — assigned projects; status and notes on tasks owned by this worker.
- `other.demo` — second worker to demonstrate isolation.

All three use the password supplied on **first seed**. Restarting with a different
environment value does not overwrite existing password hashes. No accounts are
created unless `DEMO_MODE=1`; no passwords are stored in source or plaintext in SQLite.
The demo password is shared only to simplify this local demonstration. Production
identity provisioning/reset/MFA are not implemented.

On macOS/Linux, use `.venv/bin/python`, export the same environment variables and
otherwise run the same Python/npm commands.

### Optional local demo autofill

In ignored `frontend/.env.local`, set `VITE_DEMO_AUTOFILL=1`,
`VITE_DEMO_USERNAME` and `VITE_DEMO_PASSWORD` to the synthetic demo account.
Restart Vite if needed. This only prefills the login form; authentication still
runs normally. The `import.meta.env.DEV` guard disables autofill in production
builds. Never use real account credentials in client-side Vite variables.

## Add the sample jobs

With the backend running, set `TALLEY_DEMO_PASSWORD` to the same value in another
terminal and run:

```powershell
.venv/Scripts/python.exe scripts/seed_demo.py --showcase
```

Without `--showcase` the script creates only **Demo · South Philadelphia kitchen
refresh** and its saved draft, which the walkthrough uses. With it, six more jobs
are added, one at each stage: a lead, an approved estimate waiting for its project,
an active job with a blocked and an overdue task, an active job on track, one on
hold and one complete. Jobs that already exist are skipped. Every name, address,
person and price is synthetic. Set `TALLEY_API_URL` to seed an API on another port.
See [Anthony's demo walkthrough](docs/DEMO.md).

## Persistence, migrations and security

- SQLite defaults to `backend/data/talley.db` when starting from `backend`.
  Override with an absolute `DATABASE_PATH` to avoid working-directory ambiguity.
- The original boards/groups/items/team/activity tables are retained.
  Additive migration `backend/migrations/001_estimating.sql` introduces customers,
  jobs, estimates, project origins, users, assignments and sessions. Existing
  board/task data is not replaced. Take a database backup before using a new build
  with any non-demo data.
- The old fictional Tennessee mega-project seed is now opt-in via
  `SEED_LEGACY_DEMO=1`. It is not used by the sample workflow.
- Passwords use salted scrypt. Random session tokens are stored only as SHA-256
  hashes on the server; cookies are HttpOnly, SameSite=Lax, eight-hour expiry and
  Secure by default. Logout revokes the token. Login failures are rate-limited.
- All legacy cost-bearing endpoints require an administrator. Field endpoints
  explicitly project allowed fields and recheck current board assignments on
  every request. A worker cannot change price, assignment, due date or other
  workers' tasks by calling endpoints directly.
- Mutations require a custom same-origin header; wildcard CORS was removed.
  Use the Vite `/api` proxy locally. A future deployment must keep the UI and API
  on the same origin. The old cross-origin native API configuration is not
  supported by this session-based browser workflow.
- Approval is a manually recorded external decision, not an electronic signature.
  Approved documents include frozen customer/site/scope/pricing, approver,
  recording administrator, note and timestamp. SQL triggers prevent updates/deletes.
- Conversion uses a SQLite write transaction and a unique job → project link.
  Concurrent/repeated requests open the same project. Later approved revisions do
  not silently replace the existing project budget; change-order reconciliation is deferred.

## Calculation assumptions — confirm with Anthony

USD; quantity up to three decimal places; unit cost and percentages up to two.
Line cost = quantity × unit cost, rounded half up to cents. Line markup is a
percentage of that rounded cost, independently rounded half up. Selling price is
cost + markup. Sum selling prices, then calculate and round tax once on the chosen
base: none, materials including markup, or all selling prices.

Zero markup/no tax are the neutral defaults. Each estimate stores its own settings.
The sample uses **20% markup and 6% materials tax solely to exercise calculation**,
not as approved tax treatment or Anthony's pricing. There is no AI pricing or tax
determination. Discounts, retainage, multiple tax jurisdictions and change orders
are not in this version. Totals above $10 billion are rejected to bound numeric precision.

## Checks

```powershell
Set-Location backend
../.venv/Scripts/python.exe -m pytest -q      # API: workflow, permissions, money
Set-Location ../frontend
npm run test:unit                              # estimate maths and due dates
npm run build                                  # production build + bundle check
npx playwright install chromium
$env:TALLEY_DEMO_PASSWORD = Read-Host 'Local demo password'
npm run test:e2e                               # real browser, desktop and phone size
```

- **Backend tests** use an isolated temporary database.
- **Unit tests** (`frontend/tests/unit`, Node's built-in runner, no extra packages)
  hold the editor's live totals to the same cases as the server, so what is shown
  while typing equals what is saved.
- **The build** ends with `scripts/check-bundle.mjs`, which fails if a value from
  `frontend/.env.local` (such as the demo autofill password) is in `dist/`.
- **Browser tests** create clearly named synthetic jobs and need a server that
  requires sign-in (`DEMO_SKIP_LOGIN` unset). To keep the demo database clean, run
  them against a scratch copy instead of the demo:

  ```powershell
  # terminal 1 — scratch API on its own database (seeds the demo accounts on first start)
  $env:TALLEY_DEMO_PASSWORD = Read-Host 'Local demo password'
  $env:DATABASE_PATH = "$env:TEMP\talley-scratch.db"; $env:DEMO_MODE = '1'; $env:COOKIE_SECURE = '0'
  Set-Location backend; ../.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
  # terminal 2 — a second dev server pointed at it
  $env:API_URL = 'http://127.0.0.1:8001'; npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174
  # terminal 3 — same password as terminal 1
  $env:TALLEY_DEMO_PASSWORD = Read-Host 'Local demo password'
  $env:TALLEY_BASE_URL = 'http://127.0.0.1:5174'; npm --prefix frontend run test:e2e
  ```

Desktop and iPhone-sized Chromium projects are configured. Browser emulation is
not a physical phone or Safari test. Screenshots and failure traces are ignored
local artifacts under `frontend/test-artifacts` and `frontend/test-results`.
There is no lint or type-check configuration in the repository.

## Scope and deployment

The estimating and workspace passes described above deployed nothing. A Dockerfile
for a hosted demo was added afterwards; see "Railway demo deployment" below.
Capacitor configuration is retained as historical source, but native packaging is
outside this browser pass and its command-line tool carries known advisories
(see [build notes](docs/BUILD-NOTES.md)).

No emails, payments, accounting integrations, production AI, phone routing,
photo-upload system or production launch are added here. The marketing website
repository is untouched. This pass follows the latest user-requested manual
estimating workflow; it does not assert that a contract/change order was executed.

See [build evidence and remaining decisions](docs/BUILD-NOTES.md).


## Temporary login-free demo

Set `DEMO_MODE=1` and `DEMO_SKIP_LOGIN=1` on the API process to open the
workspace as the seeded demo administrator without entering credentials.
This grants visitors administrator access to the demo data. Use only a demo
instance. Both flags are required; normal authentication remains the default.
Existing signed-in workers retain their role restrictions. Use **Switch user**
to sign in as a field worker. Remove `DEMO_SKIP_LOGIN` to restore the login gate.
GitHub Pages still requires a separately hosted API; this does not add a backend
or database to static hosting.


## Railway demo deployment

The root Dockerfile builds React and serves it from FastAPI on the same origin.
Attach a persistent volume at `/data`; SQLite is stored at `/data/talley.db`.
Use one replica. Set the healthcheck to `/healthz` and retain secure cookies.
Set `DEMO_MODE=1`, a generated `TALLEY_DEMO_PASSWORD` (12+ characters), and
`DEMO_SKIP_LOGIN=1` only for the public synthetic-data demo. Anyone with the URL
can edit this demo. Disable login-free access before storing customer data.
Local databases and environment files are excluded from the container image.
API responses are never cached (`no-store`); the page shell is revalidated on
every visit so a new deploy is picked up; hashed files under `/assets` are cached
for a year.

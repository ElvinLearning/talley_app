# A E Talley Construction — estimating & field workspace

Built by Cozy Digital. A single-company, **local synthetic-data demo** that extends
the existing React/Vite/Tailwind + FastAPI/SQLite field board.

Start with **Jobs**: customer → job → estimate → recorded approval → project →
assigned tasks → field status update. The Projects, Crew and Overview screens from
the original app remain available to administrators.

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

## Add the sample job

With the backend running, set `TALLEY_DEMO_PASSWORD` to the same value in another
terminal and run:

```powershell
.venv/Scripts/python.exe scripts/seed_demo.py
```

The script creates **Demo · South Philadelphia kitchen refresh** and a saved draft.
It skips that named job on repeat. All names, addresses and rates are synthetic.
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
../.venv/Scripts/python.exe -m pytest -q
Set-Location ../frontend
npm run build
npx playwright install chromium
# Both local services must be running with the same demo password.
$env:TALLEY_DEMO_PASSWORD = Read-Host 'Local demo password'
npm run test:e2e
```

Backend tests use an isolated temporary database. Browser tests create clearly
named synthetic demo jobs in the running database. Run them only on a demo instance.
Desktop and iPhone-sized Chromium projects are configured. Browser emulation is
not a physical phone/Safari test. Screenshots and failure traces are ignored local
artifacts under `frontend/test-artifacts` and `frontend/test-results`.

There were no existing lint/type-check/test scripts on the source branch; its
existing production build remains the frontend compile check.

## Scope and deployment

No deployment occurred. The source branch referred to a Base44-managed external
Compose setup; no Docker/hosting/CI configuration was present in the repository.
Capacitor configuration is retained as historical source, but native packaging is
outside this browser pass.

No emails, payments, accounting integrations, production AI, phone routing,
photo-upload system or production launch are added here. The marketing website
repository is untouched. This pass follows the latest user-requested manual
estimating workflow; it does not assert that a contract/change order was executed.

See [build evidence and remaining decisions](docs/BUILD-NOTES.md).

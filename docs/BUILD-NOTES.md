# Build evidence

Two passes are recorded here, newest first: the workspace redesign
(November 11–12, 2026) and the original estimating pass (November 11, 2026).

# Workspace redesign — November 11–12, 2026

## What Anthony asked for, in his words

From the October 24 meeting transcript (00:54–00:58), read verbatim for this pass:

- Estimating "from my historical data"; his estimates sometimes come out "way high".
- For the crew: on the phone, "tell me what they're doing".
- To replace Monday: "track my projects in a list order", people "only have access
  to that project", "a workable sheet… a mix between that and a Google spreadsheet".

Those three statements drove the choices below. Still not available on this
machine or in the connected Drive: **AE-Talley-App-Meeting-Prep.pdf**, the other
estimating/project tools he mentioned, any feedback newer than October 24, and
real historical estimates or rates. Nothing here assumes their contents.

## What changed

- **Jobs is a sheet.** One row per job: stage, next step, owner, due date, value.
  Filters with counts replace the three count cards; "Needs attention" is blocked,
  overdue or unowned work. Stage changes in place. Phones get the same facts as cards.
- **One page per job.** Customer, scope, estimates, tasks, approved budget, crew
  access and activity together, with a single "Next step" and its button. The
  task sheet edits owner, due date and status in place.
- **Estimating as a sheet.** Lines are rows on desktop, compact cards on tablets
  and phones (chosen by available width). Your cost, markup, selling price and tax
  are always in view. Validation is per field, before the server is called, with
  the same limits as the server; server rejections map back to the same fields.
  Numbers can be typed with commas or a dollar sign. Ctrl/⌘+S saves.
- **Add from past estimates.** Lists lines already priced on saved estimates
  (`GET /api/price-history`, administrators only) with the job, revision and date
  each price came from. This is reuse of the company's own entries. No price is
  generated, adjusted or suggested by software.
- **Client estimate.** A letter-size document: letterhead, customer, job site,
  scope, sections with quantities and selling prices, totals, notes and the
  approval record. Print rules give page numbers, repeat a section's heading when
  it runs over a page and never split a line. No terms, licences, guarantees or
  signature wording were added; the company address and phone are also left off
  until Anthony supplies what he wants printed.
- **Field crew.** My jobs → my tasks → status, note, save, with a visible
  "Saved at" confirmation. Other people's tasks are a collapsed read-only list.
- **Every screen has an address** (hash routes, no new dependency), so refresh and
  the phone's back gesture work. Leaving unsaved work asks first. A session that
  ends mid-task asks for sign-in over the screen and keeps the work.
- **Server.** `/api/jobs` runs five queries in total instead of about five per
  job. The job page no longer downloads every job to find one. Customers load
  only when the New job form opens. Activity now records owner and due-date
  changes and crew notes. The date an estimate was last saved is stored inside
  the document so an approved revision keeps its own date.

## Defects found and fixed while verifying

- **Due dates were off by one day** (inherited from the original field board).
  A task due today read "Tomorrow" and one due yesterday was not flagged late.
  Fixed in `frontend/src/lib/format.js`, with a unit test.
- **Relative times were blank** ("Last updated", activity) for every record
  written through the app, because those timestamps carry a zone suffix the old
  parser rejected.
- **Printed section subtotals repeated on every page** a section spanned.
- **A customer, job or section name with no spaces pushed the client estimate
  sideways on a phone.** Found with deliberately long content; now covered by a test.
- **Secondary text was #808080** (about 3.5:1 on the sand background). It is now
  #655F5D, which passes WCAG AA 4.5:1 on white, paper and sand.
- Number inputs with spinners could change a price on mouse-wheel scroll; they
  are now plain decimal fields with validation.
- A hosted build marked every static file `no-store`, so the whole app was
  re-downloaded on each visit. API responses stay `no-store`; hashed assets are
  cached; the page shell revalidates.

## Verification — November 12, 2026

Run against a scratch API and database so the demo data was not touched.

| Check | Result |
| --- | --- |
| `pytest -q` (backend) | **17 passed** (one Starlette deprecation warning) |
| `npm run test:unit` | **10 passed** |
| `npm run build` | passed; bundle check: no `.env.local` value in `dist/` |
| `npm run test:e2e`, dev server | **14 passed** (7 scenarios × desktop 1440 and iPhone-13-sized Chromium) |
| `npm run test:e2e`, production build served by FastAPI from `STATIC_DIR` | **14 passed** |
| `git diff --check` | clean |

The seven browser scenarios: the full customer → estimate → approval → project →
crew update → administrator review flow (including exact totals, the client copy
containing no internal figure, print media hiding all chrome, converting twice
and getting one project); failed save keeps edits and warns before leaving;
validation marks the field and past prices can be reused; an ended session asks
for sign-in without losing the estimate; a stale copy cannot overwrite a newer
save, plus dialog focus and Enter-to-add-line; a crew account cannot reach office
screens, guessed records or any price; long content never causes sideways scroll.

Also inspected by eye: every screen at 1440, 1280, 820 and 390 px wide, empty and
error states, a 48-line estimate printed to a five-page PDF, and the production
sign-in form (empty: development autofill is not in the build).

Not verified: physical phones, Safari and Firefox, screen readers (labels, roles,
focus order and contrast were built and checked in Chromium only), and real
printers. The description cell grows with its text in Chromium (CSS
`field-sizing`); in a browser without that feature it stays one line and scrolls.

## npm audit — reviewed, not changed

`npm audit --omit=dev` (what ships to the browser): **0 vulnerabilities**.

`npm audit` (everything installed): **5** — 1 critical (`tar`), 1 high
(`@capacitor/cli`), 3 moderate (`glob`, `minimatch`, `rimraf`). All five are one
chain: the development dependency `@capacitor/cli@6.2.3` → `tar@6.2.1` and
`rimraf@4.4.1` → `glob@9.3.5` → `minimatch@8.0.7`. Nothing in `src/` imports
Capacitor, the build and tests never run its CLI, and the Docker image copies only
`dist/` out of the build stage. The advisories concern extracting or globbing
untrusted input, which only the Capacitor CLI would do.

The only fix npm offers is `@capacitor/cli@8.6.0`, a two-major-version jump that
also requires moving `@capacitor/core`, `android` and `ios` to 8. That was not
forced. The clean options are to remove the four Capacitor packages if no native
app is planned (clears all five), or to do the 6 → 8 upgrade as its own piece of
work when native packaging resumes. Either way, do not run the Capacitor CLI on
this tree as it stands.

## Deferred

- Photo uploads, time clock/GPS, phone screening, AI estimating, payments,
  accounting, emailing estimates, client portal: not built, by scope.
- Change orders: a later approved revision is recorded but does not alter the
  project budget.
- Estimator ownership before a project exists; a "lost/declined" stage; company
  details and terms on the printed estimate; per-line or per-type markup. All
  wait on Anthony (see docs/DEMO.md).
- Editing a customer or a job's name, address or scope after creation.
- The Crew and Overview pages and boards started without an estimate were
  restyled to match but not redesigned.
- A second session added a login-free demo flag and a Railway Dockerfile to this
  branch on November 11 (commits `1769ece`, `284e95e`). They were reviewed and the
  cache headers adjusted, but hosting was not exercised in this pass.

# Original estimating pass — November 11, 2026

## Repository baseline

Repository: https://github.com/ElvinLearning/talley_app

- `main` at `0ac76fbcb58c1f3f191bafa6fa32053d6d5667f4` contained only a README.
- `monday-app-integration` at `8c15a7f3aad8b9e67d37fc69c4ab25fbd38b1cc8`
  contained the working field-board app. This is the implementation baseline.
- No AGENTS.md, separate migrations, authentication, estimates, automated tests,
  lint/type-check configuration or in-repository deployment setup was present.
- The initial workspace was empty; no attached worktree or Talley checkout was
  found under Documents. Local Git/gh authentication lacked access to the private
  repository. The owner's connected GitHub account could read it.
- Source files were recovered through that connection at the pinned commit.
  The exact original Git tree (`01fa13a5a75a41e55548a8655e2a77c6d0bdb815`)
  and commit hash were verified while reconstructing a shallow local checkout.
  This preserves actual ancestry, rather than creating an unrelated app/history.
- Working branch: `codex/estimating-demo`, based on that existing implementation.
  No remote push, PR, repository transfer or deployment is implied.

## Product evidence

Read the supplied November 11 handoff and the October 24 meeting transcript:
https://docs.google.com/document/d/1Pb9Gk-rbykqU-CokBah2ItDpjewItTENgIATuvWlCjk/edit

The app discussion around 00:54–00:58 supports historical-price estimating,
simple phone-based field updates, a workable list/sheet and access limited to the
relevant project. The computer-generated transcript contains ambiguous phrasing;
the latest explicit user request governs this implementation.

Reviewed Monday's documented people, status and date column model:
https://support.monday.com/hc/en-us/articles/115005310285-Available-column-types-on-monday-com
and https://monday.com/cs/guide-thebasics

Applied those patterns as an original list of jobs with next actions and existing
task ownership/status/due dates. No Monday assets or integration were copied.

Not located in the accessible Drive accounts, local named files, Pages search or
relevant connected mail: **AE-Talley-App-Meeting-Prep.pdf**, newer direct client
feedback, the specific other estimating/project-management links, or approved
historical estimates/pricing. Related October marketing documents were found;
they do not establish additional app decisions. The handoff's November 4 summary
is context, not a claim that the underlying private chat was opened.

## Verification

Final results: **12 backend tests passed**, **4 browser tests passed** (desktop
and mobile full flow plus failed-save/navigation recovery), **Vite production
build passed**, and **git diff --check passed**. One dependency deprecation warning
remains in Starlette's test client; no test failed.

- Backend tests cover decimal half-cent rounding, all three line types,
  configurable tax bases, save/reopen/reinitialize persistence, redacted preview,
  stale versions, immutable approvals, changed scope revisions, eight concurrent
  conversions, duplicate conversion after a revision, preservation of legacy data,
  worker assignment/revocation, guessed IDs, cost-bearing endpoints, task ownership,
  malformed values, logout/expiry, missing anti-CSRF header and login throttling.
- Playwright exercises customer/job entry through pricing, multiple sections,
  reload, preview, approval, project creation, assignment, task due date and worker
  status/notes in real Chromium at desktop and iPhone-sized viewports.
  The administrator then reopens the task to verify the worker's saved update.
  A simulated 503 verifies the estimate remains editable and can be retried.
- Production frontend build and Git whitespace checks are run before handoff.
- Screenshots were inspected; automated viewport checks assert no document/main
  horizontal overflow. Physical phones and Safari were not tested.
- No pre-existing tests/lint/type checks were available beyond the Vite build.

## Known limits and follow-up

- This remains a demo, not production access management: no user invitation,
  password reset, MFA, backup/restore UI, deployment or monitoring.
- Sessions require same-origin browser access. The previous native-shell
  cross-origin instructions no longer apply without further authentication work.
- SQLite is appropriate for the current local single-company demonstration.
  Hosting, backup/restore, data retention and pilot-user arrangements remain open.
- Project budget and scope are the first converted approved revision. Later
  revisions are preserved but require a separately designed change-order workflow.
- Lead entry is represented by a job in the lead status; there is no automated
  lead capture, integration, notification, client portal or client email.
- Phone screening, photo uploads and the broader agreement discovery deliverables
  are not represented as implemented by this estimating pass.
- Full `npm audit` reports five inherited development-tool advisories in the
  Capacitor CLI → tar/rimraf/glob/minimatch chain (including one critical tar entry).
  `npm audit --omit=dev` reports zero. Native tooling was not used or upgraded
  across major versions in this browser-only pass. Resolve before using the native
  toolchain. No production-security readiness claim is made.

Commercial status, kickoff, signatures and payments were not authenticated or
changed. The marketing repository and public website were not modified.

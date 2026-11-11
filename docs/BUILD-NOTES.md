# Build evidence — November 11, 2026

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

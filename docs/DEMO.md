# Anthony's demo walkthrough

About ten minutes. Use the local demo accounts described in the README. Seed the
sample jobs first with `scripts/seed_demo.py --showcase`. No real client records or
prices are needed; everything on screen is synthetic.

Screenshots of each step are in [docs/screenshots](screenshots).

## 1. Jobs — what needs attention today

Sign in as **admin.demo**, then open **Jobs**. It is a sheet: one row per job with its stage,
next step, who owns it, when it is due and what it is worth.

- **Demo · Girard Avenue porch repair** is at the top: its next step is **Blocked**
  and overdue. "Needs attention" at the top counts jobs like this.
- Each of the other rows shows a different stage: a lead waiting for an estimate,
  a draft estimate, an approved estimate waiting for its project, a job on track
  and one on hold. **Complete** holds the finished roof patch.
- Type in the search box, or press `/`. Change a stage straight from its row.
- **New job** takes the customer, the site and what they asked for.

## 2. One job, one page

Open **Demo · Girard Avenue porch repair**.

- **Next step** says what to do and has the button for it (Open task).
- **Tasks** is the working sheet. Change an owner, a due date or a status in place;
  it saves as you change it. Type in "Add a task and press Enter" to add one.
- On the right: the customer's phone number, the approved scope, the approved
  budget (contract total and internal cost budget), who on the crew can open the
  job, and below, the estimates and the activity log.
- **Prime and paint** has no owner. Assign it to **Demo field worker**.

## 3. Build an estimate

Go back to Jobs and open **Demo · South Philadelphia kitchen refresh**, then
**Continue estimate**. It has two sections and three lines:

| Item | Quantity | Unit cost | Your cost | Price at 20% markup |
| --- | ---: | ---: | ---: | ---: |
| Preparation and installation labor | 8 hours | $65.00 | $520.00 | $624.00 |
| Tile allowance | 100 sq ft | $3.25 | $325.00 | $390.00 |
| Electrical subcontract allowance | 1 allowance | $250.00 | $250.00 | $300.00 |

The panel keeps the whole calculation in view: **your cost $1,095.00** by labor,
materials and subcontractors, **markup $219.00**, then what the client sees:
subtotal **$1,314.00**, illustrative materials tax **$23.40**, total **$1,337.40**.

- Change a quantity. The totals follow as you type and the chip beside the title
  turns to **Unsaved changes**. **Save estimate** (or Ctrl+S) turns it to **Saved**.
- Type `0` in a quantity and save: the field is marked, the reason is written
  under the line, and nothing is saved until it is fixed. Put the value back.
- **Add from past estimates** lists lines already priced on saved estimates, with
  the job and date each price came from. Pick one to add it. These are the
  company's own numbers; nothing is generated.
- Refresh the browser. The same estimate comes back with the saved values.

## 4. What the customer gets

**Client preview** shows the estimate as a letter-size document: customer, job
site, scope, each section with quantities and selling prices, subtotal, tax and
total. Costs and markup are not on it. **Print / save PDF** produces the document;
nothing is emailed. Go **Back to estimate**.

## 5. Record the approval

Under **Record customer approval** enter **Jordan Example** and **Synthetic
approval during demo**, select **Record approval & lock revision**, then confirm
with **Yes, record approval**. The revision is now locked and says who approved,
when and on what evidence. This records a decision made outside the app; it is
not an electronic signature.

## 6. Turn it into a project

**Create project** opens the job page with the project in place: the sections of
the estimate are the task sections, and the approved budget shows a contract total
of **$1,337.40** and a cost budget of **$1,095.00**. Open **Revision 1** again and
choose **Open project**: it returns to the same project. A job only ever gets one.

Tick **Demo field worker** under Crew access. Use **+ Task** in Kitchen preparation
& tile to add **Measure kitchen**, owner **Demo field worker**, with a due date.
Back on Jobs, that task is now this job's next step.

## 7. On the crew's phone

Sign out and sign in as **worker.demo** (narrow the window, or use a phone).

- **My jobs** lists only the jobs this person was given, with their open tasks.
- Open the kitchen job. Tap a status for **Measure kitchen**, add a short note and
  **Save update**. The card confirms **Saved at** with the time.
- There are no prices anywhere in this view. **other.demo** has no jobs and sees
  none of this.

Sign back in as **admin.demo**: the job's Activity shows the crew's update and the
task shows the new status and note.

## 8. A change after approval

On the kitchen job, **Create revision**. Change the scope or a price and save.
Revision 1 stays exactly as approved, and the project's budget stays at revision 1.
A later revision is a record of a new price, not an automatic change order.

## Questions for Anthony

- Who may price and approve estimates, and who on the crew needs a login?
- His real labor, material and subcontractor rates; how he marks up (one rate, or
  by type); what is taxable and at what rate; any rounding he uses.
- What must be printed on an estimate he sends: company address, phone, licence
  numbers, payment terms, how long a price holds, any required wording.
- What should happen to the project budget when a later revision is approved?
- What evidence of approval he wants kept (a note, or an uploaded signed copy).
- Who owns a job before it becomes a project? The sheet shows "Office" for those
  steps because there is no estimator field yet.
- Is "Complete" enough for a job that was lost or declined, or does he want a
  separate stage for it?
- Whether a native phone app is still wanted. If not, the unused Capacitor
  packages can be removed, which also clears every open npm advisory.
- Please supply AE-Talley-App-Meeting-Prep.pdf, the other estimating and
  project tools he mentioned, and two or three real past estimates before the
  demo pricing or these workflow choices are treated as final.
## Today and estimate-library walkthrough — November 12, 2026

1. Sign in as the demo administrator. Today opens with the jobs that need review.
   Use New job to capture a customer, site and scope, or open a priority job.
2. Open Jobs to use the existing sheet and estimating/approval workflow above.
3. Open Library. Search `tile`; approved estimates are shown by default. Every
   unit cost has its job, revision and date. Open the source to inspect the estimate.
4. Uncheck Approved estimates only and press Search to include drafts. Draft
   results are labelled; no price has been generated or adjusted by AI.
5. Review Connected services below the library: all external providers remain
   disconnected. Approval and conversion now record local events for future APIs.
6. Switch to a worker account: the library and internal-cost APIs remain blocked.

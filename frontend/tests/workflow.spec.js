// End-to-end checks in a real browser, at desktop and phone size.
// They create synthetic jobs, so run them against a demo or scratch instance:
//   TALLEY_BASE_URL=http://127.0.0.1:5174 TALLEY_DEMO_PASSWORD=… npm run test:e2e
// The server must require sign-in (DEMO_SKIP_LOGIN unset).
import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const password = process.env.TALLEY_DEMO_PASSWORD
test.beforeEach(() => {
  if (!password) throw new Error('Set TALLEY_DEMO_PASSWORD for the local demo server')
})

async function login(page, username) {
  await page.goto('/')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

/** Sign out and wait for the sign-in screen, so the next step never races the logout request. */
async function signOut(page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  expect(await page.locator('main').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBeTruthy()
}

/** Create a customer and job through the form and land on the new job's page. */
async function createJob(page, name, scope = 'Synthetic demo scope.') {
  await page.getByRole('button', { name: 'New job', exact: true }).first().click()
  await page.getByLabel('Customer name', { exact: true }).fill('Demo Homeowner')
  await page.getByLabel('Contact person', { exact: true }).fill('Jordan Demo')
  await page.getByLabel('Email', { exact: true }).fill('jordan@example.test')
  await page.getByLabel('Phone', { exact: true }).fill('215-555-0100')
  await page.getByLabel('Job name', { exact: true }).fill(name)
  await page.getByLabel('Site address', { exact: true }).fill('100 Example Street, Philadelphia, PA')
  await page.getByLabel('Scope of work', { exact: true }).fill(scope)
  await page.getByRole('button', { name: 'Create job', exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

const startEstimate = (page) => page.getByRole('button', { name: 'Build estimate', exact: true }).first().click()
const saveEstimate = (page) => page.getByRole('button', { name: 'Save estimate', exact: true }).first().click()
const saveState = (page) => page.getByTestId('save-state')
const line = (page, label, index = 0) => page.getByLabel(label, { exact: true }).nth(index)

test('customer → estimate → approval → project → assigned worker', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const jobName = 'Demo Kitchen ' + testInfo.project.name + ' ' + Date.now()
  await login(page, 'admin.demo')
  await createJob(page, jobName, 'Synthetic demo: prepare kitchen, install tile, coordinate electrical work.')

  // Build a two-section estimate with all three line types.
  await startEstimate(page)
  await page.getByLabel('Section 1 name', { exact: true }).fill('Kitchen')
  await page.getByLabel('Markup on cost (%)', { exact: true }).fill('20')
  await page.getByLabel('Tax rate (%)', { exact: true }).fill('6')
  await page.getByLabel('Tax applies to', { exact: true }).selectOption('materials')
  await line(page, 'Description').fill('Install')
  await line(page, 'Quantity').fill('8')
  await line(page, 'Unit cost').fill('65')
  await page.getByRole('button', { name: 'Add line', exact: true }).click()
  await line(page, 'Description', 1).fill('Tile')
  await page.getByLabel(/^Type/).nth(1).selectOption('material')
  await line(page, 'Quantity', 1).fill('100')
  await line(page, 'Unit', 1).fill('sq ft')
  await line(page, 'Unit cost', 1).fill('3.25')
  await page.getByRole('button', { name: 'Add section', exact: true }).click()
  await page.getByLabel('Section 2 name', { exact: true }).fill('Electrical')
  await line(page, 'Description', 2).fill('Electrical subcontract')
  await page.getByLabel(/^Type/).nth(2).selectOption('subcontractor')
  await line(page, 'Unit', 2).fill('allowance')
  await line(page, 'Unit cost', 2).fill('250')

  // Cost, markup, price and tax are each shown and exact before saving.
  await expect(page.getByTestId('client-total')).toHaveText('$1,337.40')
  await expect(page.getByTestId('line-cost').nth(1)).toHaveText('$325.00')
  await expect(page.getByTestId('line-price').nth(1)).toHaveText('$390.00')
  await expect(saveState(page)).toHaveText('Unsaved changes')
  await noOverflow(page)
  await saveEstimate(page)
  await expect(saveState(page)).toContainText('Saved')
  fs.mkdirSync('test-artifacts', { recursive: true })
  await page.screenshot({ path: 'test-artifacts/' + testInfo.project.name + '-estimate.png', fullPage: true })

  // Refresh: the URL brings back the same estimate with the saved values.
  await page.reload()
  await expect(line(page, 'Description', 1)).toHaveValue('Tile')
  await expect(page.getByTestId('client-total')).toHaveText('$1,337.40')

  // The client copy has selling prices only.
  await page.getByRole('button', { name: 'Client preview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Estimate', exact: true })).toBeVisible()
  await expect(page.getByTestId('proposal-total')).toHaveText('$1,337.40')
  const proposal = await page.locator('.proposal').innerText()
  for (const internal of ['$65', '$3.25', '$250.00', '$1,095.00', '$219.00', 'Markup', 'cost', 'Internal', 'Labor', 'Material']) expect(proposal).not.toContain(internal)
  await noOverflow(page)
  await page.screenshot({ path: 'test-artifacts/' + testInfo.project.name + '-preview.png', fullPage: true })
  // Printed: the page is the document only — no navigation, buttons or demo banner.
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: 'Print / save PDF' })).toBeHidden()
  await expect(page.getByRole('navigation').first()).toBeHidden()
  await expect(page.getByTestId('proposal-total')).toBeVisible()
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('link', { name: 'Back to estimate', exact: true }).click()

  // Record the approval; the revision locks.
  await page.getByLabel('Approved by', { exact: true }).fill('Jordan Demo')
  await page.getByLabel('Approval evidence / note', { exact: true }).fill('Synthetic approval during the demo; no customer communication.')
  await page.getByRole('button', { name: 'Record approval & lock revision', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, record approval', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Approved and locked', exact: true })).toBeVisible()
  await expect(line(page, 'Description')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save estimate' })).toHaveCount(0)

  // Convert, then convert again: still one project.
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Crew access', exact: true })).toBeVisible()
  const jobUrl = page.url()
  await page.getByRole('link', { name: /Revision 1/ }).click()
  await page.getByRole('button', { name: 'Open project', exact: true }).click()
  await expect(page).toHaveURL(jobUrl)
  await expect(page.getByText('Project baseline')).toHaveCount(1)

  // Give the worker access and a dated task.
  await page.getByLabel('Demo field worker', { exact: true }).check()
  await expect(page.getByText('Crew access saved.')).toBeVisible()
  await page.getByRole('button', { name: /^Add task to / }).first().click()
  await page.getByLabel('Task', { exact: true }).fill('Measure kitchen')
  await page.getByLabel('Owner', { exact: true }).selectOption({ label: 'Demo field worker' })
  await page.getByLabel('Due date', { exact: true }).fill('2026-11-20')
  await page.getByRole('dialog').getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(page.getByText('Measure kitchen', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  // The task sheet's column headings belong to the desktop sheet only; phones get cards.
  const wide = page.viewportSize().width >= 768
  await expect(page.locator('.task-head')).toBeVisible({ visible: wide })
  await expect(page.getByLabel('Owner for Measure kitchen')).toBeVisible({ visible: wide })
  await noOverflow(page)
  await page.screenshot({ path: 'test-artifacts/' + testInfo.project.name + '-project.png', fullPage: true })
  await page.getByRole('link', { name: 'Jobs', exact: true }).click()
  await expect(page.getByText('Measure kitchen', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: 'test-artifacts/' + testInfo.project.name + '-jobs.png', fullPage: true })
  await signOut(page)

  // The worker sets a status and a note, and gets a clear confirmation.
  await login(page, 'worker.demo')
  await expect(page.getByRole('heading', { name: 'My jobs', exact: true })).toBeVisible()
  await page.getByRole('link').filter({ hasText: jobName }).click()
  const task = page.getByRole('form', { name: 'Measure kitchen', exact: true })
  await task.locator('label').filter({ has: page.getByRole('radio', { name: 'Done', exact: true }) }).click()
  await task.getByLabel('Note for the office (optional)', { exact: true }).fill('Measured and ready for review.')
  await task.getByRole('button', { name: 'Save update', exact: true }).click()
  await expect(task.getByRole('status')).toContainText('Saved at')
  await noOverflow(page)
  await page.screenshot({ path: 'test-artifacts/' + testInfo.project.name + '-worker.png', fullPage: true })
  await signOut(page)

  // The administrator sees the worker's update.
  await login(page, 'admin.demo')
  await page.getByRole('link').filter({ hasText: jobName }).filter({ visible: true }).click()
  await expect(page.getByText('Demo field worker moved Measure kitchen to Done')).toBeVisible()
  await page.getByRole('button').filter({ has: page.getByText('Measure kitchen', { exact: true }) }).click()
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Field notes', { exact: true })).toHaveValue('Measured and ready for review.')
  expect(errors).toEqual([])
})

test('failed save preserves edits and navigation warns', async ({ page }) => {
  await login(page, 'admin.demo')
  await createJob(page, 'Demo save recovery ' + Date.now())
  await startEstimate(page)
  await line(page, 'Description').fill('Keep this edit after a failed save')
  await line(page, 'Unit cost').fill('100')
  await page.route('**/api/estimates/*', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Simulated service interruption' }) })
    else await route.continue()
  })
  await saveEstimate(page)
  await expect(page.getByRole('alert')).toContainText('Simulated service interruption')
  await expect(saveState(page)).toHaveText('Not saved')
  await expect(line(page, 'Description')).toHaveValue('Keep this edit after a failed save')
  // Leaving is confirmed first; cancelling stays on the estimate.
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('link', { name: /Demo save recovery/ }).click()
  await expect(line(page, 'Description')).toBeVisible()
  await page.unroute('**/api/estimates/*')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(saveState(page)).toContainText('Saved')
})

test('validation points at the field, and past prices can be reused', async ({ page }) => {
  const stamp = Date.now()
  const item = 'Demo reuse item ' + stamp
  await login(page, 'admin.demo')
  await createJob(page, 'Demo validation ' + stamp)
  await startEstimate(page)
  await line(page, 'Description').fill(item)
  await line(page, 'Quantity').fill('0')
  await line(page, 'Unit', 0).fill('each')
  await line(page, 'Unit cost').fill('12.345')
  await saveEstimate(page)
  await expect(page.getByRole('alert')).toContainText('Fix the 2 highlighted fields')
  await expect(line(page, 'Quantity')).toHaveAttribute('aria-invalid', 'true')
  await expect(line(page, 'Quantity')).toBeFocused()
  await expect(page.getByText('Quantity: Must be more than 0 · Unit cost: Up to 2 decimal places')).toBeVisible()
  await expect(saveState(page)).toHaveText('Unsaved changes')

  // Commas are accepted the way people type them; Ctrl+S saves.
  await line(page, 'Quantity').fill('1,200')
  await line(page, 'Unit cost').fill('12.34')
  await expect(page.getByTestId('line-cost')).toHaveText('$14,808.00')
  await page.keyboard.press('Control+s')
  await expect(saveState(page)).toContainText('Saved')
  await expect(line(page, 'Quantity')).toHaveValue('1200')

  // A second job reuses that saved line: same type, unit and unit cost.
  await page.getByRole('link', { name: /Demo validation/ }).click()
  await page.getByRole('link', { name: 'All jobs', exact: true }).click()
  await createJob(page, 'Demo reuse ' + stamp)
  await startEstimate(page)
  await page.getByRole('button', { name: 'Add from past estimates', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Add from past estimates' })
  await sheet.getByLabel('Search past lines').fill(String(stamp))
  await sheet.getByRole('button').filter({ hasText: item }).click()
  await sheet.getByRole('button', { name: /^Done/ }).click()
  await expect(line(page, 'Description')).toHaveValue(item)
  await expect(line(page, 'Unit', 0)).toHaveValue('each')
  await expect(line(page, 'Unit cost')).toHaveValue('12.34')
  await expect(line(page, 'Description')).toHaveCount(1)
  await noOverflow(page)
})

test('an ended session asks for sign-in without losing the estimate', async ({ page, context }) => {
  await login(page, 'admin.demo')
  await createJob(page, 'Demo session ' + Date.now())
  await startEstimate(page)
  await line(page, 'Description').fill('Typed before the session ended')
  await line(page, 'Unit cost').fill('80')
  await context.clearCookies()
  await saveEstimate(page)
  const again = page.getByRole('dialog', { name: 'Sign in again' })
  await expect(again).toContainText('Your session ended')
  await again.getByLabel('Username', { exact: true }).fill('admin.demo')
  await again.getByLabel('Password', { exact: true }).fill(password)
  await again.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(again).toBeHidden()
  await expect(line(page, 'Description')).toHaveValue('Typed before the session ended')
  await saveEstimate(page)
  await expect(saveState(page)).toContainText('Saved')
})

test('a stale copy cannot overwrite a newer save, and the keyboard works', async ({ page }) => {
  await login(page, 'admin.demo')
  // The dialog takes focus when it opens and hands it back when closed with Escape.
  const newJob = page.getByRole('button', { name: 'New job', exact: true }).first()
  await newJob.click()
  await expect(page.getByRole('dialog', { name: 'New job' }).locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(newJob).toBeFocused()

  await createJob(page, 'Demo stale copy ' + Date.now())
  await startEstimate(page)
  await line(page, 'Description').fill('First line')
  await line(page, 'Unit cost').fill('10')
  // Enter on the last line starts the next one, cursor in its description.
  await line(page, 'Unit cost').press('Enter')
  await expect(line(page, 'Description', 1)).toBeFocused()
  await page.keyboard.type('Second line')
  await line(page, 'Unit cost', 1).fill('20')
  await saveEstimate(page)
  await expect(saveState(page)).toContainText('Saved')

  // The same estimate is saved from somewhere else (another tab or person)…
  const id = Number(page.url().match(/estimates\/(\d+)/)[1])
  const current = await (await page.request.get(`/api/estimates/${id}`)).json()
  const document = current.document
  const elsewhere = await page.request.put(`/api/estimates/${id}`, {
    headers: { 'X-Talley-Request': '1' },
    data: {
      version: current.version, markup_percent: document.markup_percent, tax_percent: document.tax_percent, tax_basis: document.tax_basis, notes: document.notes,
      sections: [{ name: 'Saved elsewhere', lines: [{ description: 'Newer line', kind: 'labor', quantity: '1', unit: 'hour', unit_cost: '99' }] }],
    },
  })
  expect(elsewhere.status()).toBe(200)
  // …so this copy is refused rather than silently replacing it.
  await line(page, 'Description').fill('Older edit')
  await saveEstimate(page)
  await expect(page.getByRole('alert').filter({ hasText: 'changed somewhere else' })).toBeVisible()
  expect((await (await page.request.get(`/api/estimates/${id}`)).json()).document.sections[0].name).toBe('Saved elsewhere')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Load latest version', exact: true }).click()
  await expect(line(page, 'Description')).toHaveValue('Newer line')
  await expect(saveState(page)).toContainText('Saved')
})

test('field crew reach only their own jobs and never see prices', async ({ page }) => {
  await login(page, 'other.demo')
  await expect(page.getByRole('heading', { name: 'No jobs yet', exact: true })).toBeVisible()
  // Office screens and guessed records are not reachable from a crew account.
  for (const route of ['/jobs', '/jobs/1', '/jobs/1/estimates/1', '/jobs/1/estimates/1/preview', '/overview', '/crew', '/projects', '/boards/1']) {
    await page.goto('/#' + route)
    await expect(page.getByRole('heading', { name: 'That page isn’t here' })).toBeVisible()
  }
  await page.goto('/#/work/1')
  await expect(page.getByRole('alert')).toContainText('Assigned project not found')
  for (const path of ['/jobs', '/jobs/1', '/estimates/1', '/estimates/1/preview', '/price-history', '/boards/1', '/customers', '/overview', '/team', '/workers']) {
    expect((await page.request.get('/api' + path)).status(), path).toBe(403)
  }
  await signOut(page)

  await login(page, 'worker.demo')
  await expect(page.getByRole('heading', { name: 'My jobs', exact: true })).toBeVisible()
  const work = await (await page.request.get('/api/work')).text()
  for (const word of ['cost', 'budget', 'markup', 'contract', 'price', 'cents']) expect(work, word).not.toContain(word)
  await expect(page.locator('main')).not.toContainText('$')
  await noOverflow(page)
})

test('long names, emails and descriptions never push a page sideways', async ({ page }) => {
  await login(page, 'admin.demo')
  await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible()
  const api = async (method, url, data) => {
    const response = await page.request.fetch('/api' + url, { method, data, headers: { 'X-Talley-Request': '1' } })
    expect(response.ok(), `${method} ${url}`).toBeTruthy()
    return response.json()
  }
  const unbroken = 'Supercalifragilisticexpialidocious-StorefrontWithoutSpaces-' + Date.now()
  const customer = await api('POST', '/customers', { name: 'Demo customer with a very long company name, Holdings and Associates of Greater Philadelphia', contact: 'Alexandria Montgomery-Featherstonehaugh', email: 'a.very.long.email.address.for.testing@subdomain.example.test', phone: '215-555-0199 ext. 12345' })
  const job = await api('POST', '/jobs', { customer_id: customer.id, name: 'Demo long content ' + unbroken, address: '12345 Example Boulevard, Building C, Suite 400, Philadelphia, PA 19104', scope: 'Synthetic long scope. '.repeat(40) })
  const estimate = await api('POST', `/jobs/${job.id}/estimates`)
  await api('PUT', `/estimates/${estimate.id}`, {
    version: estimate.version, markup_percent: '20', tax_percent: '6', tax_basis: 'all', notes: 'Synthetic note. '.repeat(30),
    sections: [{ name: 'A section with a long name ' + unbroken, lines: [{ description: 'A deliberately long description ' + unbroken + ' to see how it wraps', kind: 'material', quantity: '1234.567', unit: 'linear foot', unit_cost: '98765.43' }] }],
  })
  for (const route of ['/jobs', `/jobs/${job.id}`, `/jobs/${job.id}/estimates/${estimate.id}`, `/jobs/${job.id}/estimates/${estimate.id}/preview`]) {
    await page.goto('/#' + route)
    await page.reload() // the records were created through the API, behind the open page's back
    await expect(page.getByText(unbroken).filter({ visible: true }).first()).toBeVisible()
    await noOverflow(page)
  }
})

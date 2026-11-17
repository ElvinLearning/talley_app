import { test, expect } from '@playwright/test'

const password = process.env.TALLEY_DEMO_PASSWORD
const panel = page => page.getByRole('region', { name: 'Guided walkthrough' })

test.beforeEach(async ({ page }) => {
  if (!password) throw new Error('Set TALLEY_DEMO_PASSWORD for a scratch server that requires sign-in')
  // Visiting the AI step must not depend on a provider or spend any credit.
  await page.route('**/api/ai/status', route => route.fulfill({ json: {
    configured: false, valid: false, paid_models_allowed: false, message: 'Synthetic test: no provider connected.',
  } }))
  await page.route('**/api/ai/models', route => route.fulfill({ json: { models: [], paid_models_allowed: false } }))
  await page.route('**/api/ai/chat', route => route.abort())
})

async function login(page, username = 'admin.demo') {
  await page.goto('/')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
}

async function api(page, method, path, data) {
  const response = await page.request.fetch('/api' + path, {
    method, data, headers: { 'X-Talley-Request': '1' },
  })
  expect(response.ok(), `${method} ${path}`).toBeTruthy()
  return response.json()
}

async function examples(page) {
  const customer = await api(page, 'POST', '/customers', { name: 'Demo tour customer', contact: 'Sample contact' })
  async function makeJob(name) {
    return api(page, 'POST', '/jobs', { customer_id: customer.id, name,
      address: '100 Example Street, Philadelphia (synthetic)', scope: 'Synthetic walkthrough scope.' })
  }
  async function makeEstimate(job) {
    const estimate = await api(page, 'POST', `/jobs/${job.id}/estimates`)
    return api(page, 'PUT', `/estimates/${estimate.id}`, {
      version: estimate.version, markup_percent: '20', tax_percent: '0', tax_basis: 'none', notes: '',
      sections: [{ name: 'Demo work', lines: [{ description: 'Synthetic labor', kind: 'labor', quantity: '2', unit: 'hour', unit_cost: '50' }] }],
    })
  }
  const draftJob = await makeJob('Demo tour kitchen ' + Date.now())
  const draft = await makeEstimate(draftJob)
  const projectJob = await makeJob('Demo tour project ' + Date.now())
  const approved = await makeEstimate(projectJob)
  await api(page, 'POST', `/estimates/${approved.id}/approve`, { version: approved.version, approved_by: 'Demo customer', note: 'Synthetic tour fixture' })
  const project = await api(page, 'POST', `/estimates/${approved.id}/convert`)
  const board = await api(page, 'GET', `/boards/${project.board_id}`)
  const worker = (await api(page, 'GET', '/workers')).find(entry => entry.name === 'Demo field worker')
  await api(page, 'PUT', `/boards/${board.id}/assignments`, { user_ids: [worker.id] })
  await api(page, 'POST', `/groups/${board.groups[0].id}/items`, { name: 'Demo tour task', owner: worker.name, cost: 100 })
  const jobs = [await api(page, 'GET', `/jobs/${draftJob.id}`), await api(page, 'GET', `/jobs/${projectJob.id}`)]
  // Select from actual saved records with IDs allocated by the scratch database.
  await page.route('**/api/jobs', route => route.fulfill({ json: jobs }))
  return { draftJob, draft, projectJob, board }
}

async function openGuide(page) {
  await page.goto('/#/guide')
  await expect(page.getByRole('heading', { name: 'Demo walkthrough', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Start|Resume) walkthrough$/ })).toBeEnabled()
}

async function jump(page, title) {
  const select = panel(page).getByRole('combobox')
  const value = await select.getByRole('option').filter({ hasText: title }).getAttribute('value')
  await select.selectOption(value)
  await expect(select).toHaveValue(value)
  return value
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy()
}

test('guide navigates real examples, resumes after reload, and never writes or chats', async ({ page }) => {
  await login(page)
  const records = await examples(page)
  await page.reload() // The provider discovers the controlled saved examples.
  const writes = []
  const errors = []
  const apiErrors = []
  page.on('request', request => { if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) apiErrors.push(`${response.status()} ${response.url()}`) })
  await openGuide(page)
  await page.getByRole('button', { name: 'Start walkthrough', exact: true }).click()
  await expect(page).toHaveURL(/#\/today$/)
  await expect(panel(page).getByRole('button', { name: 'Previous walkthrough step' })).toBeDisabled()
  await panel(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/#\/jobs$/)
  await panel(page).getByRole('button', { name: 'Previous walkthrough step' }).click()
  await expect(page).toHaveURL(/#\/today$/)
  const estimateIndex = await jump(page, 'Build and save an estimate')
  await expect(page).toHaveURL(new RegExp(`#/jobs/${records.draftJob.id}/estimates/${records.draft.id}$`))
  await expect(page.getByLabel('Description', { exact: true }).first()).toHaveValue('Synthetic labor')
  await panel(page).getByRole('button', { name: 'Close walkthrough' }).click()
  await expect(panel(page)).toHaveCount(0)
  await page.reload()
  await expect(panel(page)).toHaveCount(0)
  await openGuide(page)
  await page.getByRole('button', { name: 'Resume walkthrough', exact: true }).click()
  await expect(panel(page).getByRole('combobox')).toHaveValue(estimateIndex)
  await jump(page, 'See the field experience')
  await expect(page).toHaveURL(new RegExp(`#/field-preview/${records.board.id}$`))
  await expect(page.getByText('Field experience · read-only preview')).toBeVisible()
  await expect(page.getByLabel('Note for the office (optional)')).toBeDisabled()
  for (const radio of await page.locator('main').getByRole('radio').all()) await expect(radio).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save update', exact: true })).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('$')
  expect((await api(page, 'GET', '/auth/me')).role).toBe('admin')
  await noOverflow(page)
  await jump(page, 'Try AI models and roles')
  await expect(page.getByRole('heading', { name: 'AI test', exact: true })).toBeVisible()
  const draftJobPath = `/jobs/${records.draftJob.id}`
  const projectJobPath = `/jobs/${records.projectJob.id}`
  const estimatePath = `${draftJobPath}/estimates/${records.draft.id}`
  const stepPaths = ['/today', '/jobs', '/jobs', draftJobPath, estimatePath, estimatePath,
    `${estimatePath}/preview`, estimatePath, draftJobPath, projectJobPath,
    `/field-preview/${records.board.id}`, projectJobPath, '/crew', '/overview', '/projects', '/assistant', '/ai', '/guide']
  await expect(panel(page).getByRole('option')).toHaveCount(stepPaths.length)
  for (const [index, path] of stepPaths.entries()) {
    await panel(page).getByRole('combobox').selectOption(String(index))
    await expect(panel(page).getByRole('combobox')).toHaveValue(String(index))
    await expect(page).toHaveURL(new RegExp(`#${path}$`))
    await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
    await noOverflow(page)
  }
  await panel(page).getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(panel(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'You reached the end of the guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Restart', exact: true }).click()
  await expect(panel(page).getByRole('combobox')).toHaveValue('0')
  await expect(page).toHaveURL(/#\/today$/)
  await noOverflow(page)
  expect(writes).toEqual([])
  expect(errors).toEqual([])
  expect(apiErrors).toEqual([])
})

test('canceling the unsaved-change guard leaves both the editor and guide step unchanged', async ({ page }) => {
  await login(page)
  const records = await examples(page)
  await page.reload()
  await openGuide(page)
  await page.getByRole('button', { name: /Open walkthrough step .*Build and save an estimate/ }).click()
  const current = await panel(page).getByRole('combobox').inputValue()
  await page.getByLabel('Description', { exact: true }).first().fill('Keep this unsaved scope')
  page.once('dialog', dialog => dialog.dismiss())
  const target = await panel(page).getByRole('option').filter({ hasText: 'Preview the client document' }).getAttribute('value')
  await panel(page).getByRole('combobox').selectOption(target)
  await expect(panel(page).getByRole('combobox')).toHaveValue(current)
  await expect(page).toHaveURL(new RegExp(`#/jobs/${records.draftJob.id}/estimates/${records.draft.id}$`))
  await expect(page.getByLabel('Description', { exact: true }).first()).toHaveValue('Keep this unsaved scope')
  await panel(page).getByRole('button', { name: 'Close walkthrough' }).click()
  await expect(page.getByLabel('Description', { exact: true }).first()).toHaveValue('Keep this unsaved scope')
})

test('workers get only field steps and the guide never requests office data', async ({ page }) => {
  await login(page)
  const records = await examples(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await login(page, 'worker.demo')
  const work = await api(page, 'GET', `/work/${records.board.id}`)
  await page.route('**/api/work', route => route.fulfill({ json: [work] }))
  const requests = []
  page.on('request', request => { if (request.url().includes('/api/')) requests.push({ method: request.method(), path: new URL(request.url()).pathname }) })
  await page.reload()
  await openGuide(page)
  await expect(page.getByRole('button', { name: /Open walkthrough step/ })).toHaveCount(4)
  await expect(page.getByRole('button', { name: /Open walkthrough step.*(estimate|approval|AI models)/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start walkthrough', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`#/work/${records.board.id}$`))
  await expect(page.getByLabel('Note for the office (optional)')).toBeEnabled()
  await panel(page).getByRole('button', { name: 'Next', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Next', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Finish', exact: true }).click()
  await noOverflow(page)
  expect(requests.every(request => request.method === 'GET')).toBeTruthy()
  expect(requests.every(request => /^\/api\/(auth\/me|work(?:\/\d+)?)$/.test(request.path))).toBeTruthy()
})

test('missing records and failed link discovery have honest fallbacks and a working retry', async ({ page }) => {
  await page.route('**/api/jobs', route => route.fulfill({ status: 503, json: { detail: 'Synthetic guide outage' } }))
  await login(page)
  await openGuide(page)
  await expect(page.locator('main').getByRole('alert')).toContainText('Synthetic guide outage')
  await page.unroute('**/api/jobs')
  await page.route('**/api/jobs', route => route.fulfill({ json: [] }))
  await page.getByRole('button', { name: 'Retry guide links', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('No saved draft is available.', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: /Open walkthrough step .*Build and save an estimate/ }).click()
  await expect(page).toHaveURL(/#\/jobs$/)
  const showInstructions = panel(page).getByRole('button', { name: 'Show step instructions' })
  if (await showInstructions.count()) await showInstructions.click()
  await expect(panel(page)).toContainText('No saved draft is available.')
  await noOverflow(page)
})

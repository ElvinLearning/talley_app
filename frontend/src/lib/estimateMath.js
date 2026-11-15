// Estimate arithmetic and validation for the editor.
//
// The server is the source of truth (backend/app/estimating.py). This mirrors
// its rules exactly — integer cents, ROUND_HALF_UP — using BigInt so the totals
// shown while typing equal what the server will save. No floating point.

export const KINDS = [
  { value: 'labor', label: 'Labor', plural: 'Labor' },
  { value: 'material', label: 'Material', plural: 'Materials' },
  { value: 'subcontractor', label: 'Subcontractor', plural: 'Subcontractors' },
]

export const TAX_BASES = [
  { value: 'none', label: 'No tax', short: '' },
  { value: 'materials', label: 'Materials (with markup)', short: 'of materials' },
  { value: 'all', label: 'All selling prices', short: 'of all prices' },
]

/** Strip the commas, dollar signs and spaces people naturally type. */
export const cleanNumber = (value) => String(value ?? '').replace(/[$,\s]/g, '')

const PLAIN_DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/

/** `value` as an integer scaled by 10^places, or null if it is not a plain number with that many decimals. */
export function scaled(value, places) {
  const text = cleanNumber(value)
  if (!PLAIN_DECIMAL.test(text)) return null
  const [whole = '', part = ''] = text.split('.')
  if (part.replace(/0+$/, '').length > places) return null
  return BigInt(whole || '0') * 10n ** BigInt(places) + BigInt((part + '0'.repeat(places)).slice(0, places) || '0')
}

const halfUp = (numerator, denominator) => (numerator + denominator / 2n) / denominator

/** Totals in integer cents. Lines with invalid numbers count as zero until fixed. */
export function totals(form) {
  const markupRate = scaled(form.markup_percent, 2) ?? 0n
  const taxRate = scaled(form.tax_percent, 2) ?? 0n
  let cost = 0n
  let markup = 0n
  let taxable = 0n
  const byKind = { labor: 0n, material: 0n, subcontractor: 0n }
  const sections = form.sections.map((section) => {
    let sectionCost = 0n
    let sectionPrice = 0n
    const lines = section.lines.map((line) => {
      const quantity = scaled(line.quantity, 3) ?? 0n
      const unitCost = scaled(line.unit_cost, 2) ?? 0n
      const lineCost = halfUp(quantity * unitCost, 1000n)
      const lineMarkup = halfUp(lineCost * markupRate, 10000n)
      cost += lineCost
      markup += lineMarkup
      byKind[line.kind] = (byKind[line.kind] ?? 0n) + lineCost
      if (form.tax_basis === 'all' || (form.tax_basis === 'materials' && line.kind === 'material')) {
        taxable += lineCost + lineMarkup
      }
      sectionCost += lineCost
      sectionPrice += lineCost + lineMarkup
      return { cost: Number(lineCost), price: Number(lineCost + lineMarkup) }
    })
    return { lines, cost: Number(sectionCost), price: Number(sectionPrice) }
  })
  const tax = halfUp(taxable * taxRate, 10000n)
  return {
    sections,
    byKind: Object.fromEntries(Object.entries(byKind).map(([kind, value]) => [kind, Number(value)])),
    cost: Number(cost),
    markup: Number(markup),
    subtotal: Number(cost + markup),
    taxable: Number(taxable),
    tax: Number(tax),
    total: Number(cost + markup + tax),
  }
}

function numberError(value, { places, min, minExclusive = false, max, name }) {
  const text = cleanNumber(value)
  if (text === '') return `Enter ${name}`
  if (!PLAIN_DECIMAL.test(text)) return 'Numbers only'
  if (scaled(text, places) === null) return places === 2 ? 'Up to 2 decimal places' : `Up to ${places} decimal places`
  const amount = Number(text)
  if (minExclusive ? amount <= min : amount < min) return minExclusive ? `Must be more than ${min}` : `Can't be less than ${min}`
  if (amount > max) return `Can't be more than ${max.toLocaleString('en-US')}`
  return ''
}

const textError = (value, max, name) => {
  const text = String(value ?? '').trim()
  if (!text) return `Enter ${name}`
  if (text.length > max) return `Keep this under ${max.toLocaleString('en-US')} characters`
  return ''
}

export const lineKey = (section, line, field) => `s${section}.l${line}.${field}`
export const sectionKey = (section) => `s${section}.name`

/** Every problem in the form, keyed by field. Same limits the server enforces. */
export function validate(form) {
  const errors = {}
  const put = (key, message) => {
    if (message) errors[key] = message
  }
  put('scope', textError(form.scope, 10000, 'the scope of work'))
  put('markup_percent', numberError(form.markup_percent, { places: 2, min: 0, max: 1000, name: 'a markup, or 0' }))
  put('tax_percent', numberError(form.tax_percent, { places: 2, min: 0, max: 100, name: 'a tax rate, or 0' }))
  if (String(form.notes ?? '').length > 5000) errors.notes = 'Keep notes under 5,000 characters'
  form.sections.forEach((section, si) => {
    put(sectionKey(si), textError(section.name, 150, 'a section name'))
    section.lines.forEach((line, li) => {
      put(lineKey(si, li, 'description'), textError(line.description, 500, 'a description'))
      put(lineKey(si, li, 'unit'), textError(line.unit, 30, 'a unit'))
      put(
        lineKey(si, li, 'quantity'),
        numberError(line.quantity, { places: 3, min: 0, minExclusive: true, max: 1000000, name: 'a quantity' })
      )
      put(lineKey(si, li, 'unit_cost'), numberError(line.unit_cost, { places: 2, min: 0, max: 10000000, name: 'a unit cost, or 0' }))
    })
  })
  return errors
}

/** Map a FastAPI 422 `detail` list onto the same field keys as `validate`. */
export function serverErrors(detail) {
  const errors = {}
  if (!Array.isArray(detail)) return errors
  for (const entry of detail) {
    const loc = (entry.loc || []).filter((part) => part !== 'body')
    const message = String(entry.msg || 'Check this value').replace(/^Value error, /, '')
    if (loc[0] === 'sections' && loc[2] === 'lines' && loc.length >= 5) errors[lineKey(loc[1], loc[3], loc[4])] = message
    else if (loc[0] === 'sections' && loc[2] === 'name') errors[sectionKey(loc[1])] = message
    else if (loc.length === 1) errors[loc[0]] = message
  }
  return errors
}

/** "1,200.50" → "1200.5", ".5" → "0.5", "8." → "8": one plain form for the server. */
export function normalNumber(value) {
  const text = cleanNumber(value)
  if (!PLAIN_DECIMAL.test(text)) return text
  const [whole = '', part = ''] = text.split('.')
  const fraction = part.replace(/0+$/, '')
  return `${whole.replace(/^0+(?=\d)/, '') || '0'}${fraction ? `.${fraction}` : ''}`
}

/** The payload the API expects: trimmed text and cleaned numbers. */
export function payloadOf(form, version) {
  return {
    version,
    scope: form.scope.trim(),
    notes: form.notes,
    markup_percent: normalNumber(form.markup_percent),
    tax_percent: normalNumber(form.tax_percent),
    tax_basis: form.tax_basis,
    sections: form.sections.map((section) => ({
      name: section.name.trim(),
      lines: section.lines.map((line) => ({
        description: line.description.trim(),
        kind: line.kind,
        quantity: normalNumber(line.quantity),
        unit: line.unit.trim(),
        unit_cost: normalNumber(line.unit_cost),
      })),
    })),
  }
}

export const blankLine = () => ({ description: '', kind: 'labor', quantity: '1', unit: 'hour', unit_cost: '' })

/** A line nobody has filled in yet (safe to replace rather than keep). */
export const isBlankLine = (line) => !line.description.trim() && (scaled(line.unit_cost, 2) ?? 0n) === 0n

/** The editable part of a saved estimate document. */
export function editable(document) {
  return {
    scope: document.job.scope,
    markup_percent: document.markup_percent,
    tax_percent: document.tax_percent,
    tax_basis: document.tax_basis,
    notes: document.notes,
    sections: document.sections.map((section) => ({
      name: section.name,
      lines: section.lines.map((line) => ({
        description: line.description,
        kind: line.kind,
        quantity: line.quantity,
        unit: line.unit,
        unit_cost: line.unit_cost,
      })),
    })),
  }
}

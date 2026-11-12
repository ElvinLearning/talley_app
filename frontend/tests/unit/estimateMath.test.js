// Run with: npm run test:unit   (Node built-in test runner; no extra packages)
// The numbers here are the same cases as backend/tests/test_workflow.py, so the
// totals shown while typing can never drift from what the server saves.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalNumber, payloadOf, scaled, serverErrors, totals, validate } from '../../src/lib/estimateMath.js'

const sample = () => ({
  scope: 'Synthetic kitchen scope',
  notes: '',
  markup_percent: '20',
  tax_percent: '6',
  tax_basis: 'materials',
  sections: [
    {
      name: 'Kitchen',
      lines: [
        { description: 'Install', kind: 'labor', quantity: '8', unit: 'hour', unit_cost: '65' },
        { description: 'Tile', kind: 'material', quantity: '100', unit: 'sq ft', unit_cost: '3.25' },
        { description: 'Electrical', kind: 'subcontractor', quantity: '1', unit: 'allowance', unit_cost: '250' },
      ],
    },
  ],
})

test('totals match the server for the demo estimate', () => {
  const sum = totals(sample())
  assert.deepEqual(
    { cost: sum.cost, markup: sum.markup, subtotal: sum.subtotal, taxable: sum.taxable, tax: sum.tax, total: sum.total },
    { cost: 109500, markup: 21900, subtotal: 131400, taxable: 39000, tax: 2340, total: 133740 }
  )
  assert.deepEqual(sum.byKind, { labor: 52000, material: 32500, subcontractor: 25000 })
  assert.deepEqual(sum.sections[0].lines[1], { cost: 32500, price: 39000 })
})

test('half cents round up exactly as the server does', () => {
  const form = sample()
  form.sections[0].lines = [{ description: 'Half cent', kind: 'material', quantity: '.005', unit: 'unit', unit_cost: '1' }]
  Object.assign(form, { markup_percent: '50', tax_percent: '25', tax_basis: 'all' })
  const sum = totals(form)
  assert.deepEqual([sum.cost, sum.markup, sum.tax, sum.total], [1, 1, 1, 3])
  assert.equal(totals({ ...form, tax_basis: 'none' }).tax, 0)
})

test('large values stay exact (no floating point)', () => {
  const form = sample()
  form.sections[0].lines = [{ description: 'Big', kind: 'material', quantity: '999999.999', unit: 'unit', unit_cost: '9999999.99' }]
  form.markup_percent = '0'
  form.tax_basis = 'none'
  // (1,000,000 - 0.001) x (10,000,000 - 0.01) = 9,999,999,980,000.00001 dollars.
  // In floating point this product is not exact; in scaled integers it is.
  assert.equal(BigInt(totals(form).cost), 999999998000000n)
  form.sections[0].lines[0].unit_cost = '0.05'
  form.sections[0].lines[0].quantity = '0.1'
  // 0.1 x 0.05 = 0.005 dollars = half a cent, which rounds up to 1 cent.
  assert.equal(totals(form).cost, 1)
})

test('numbers are read the way people type them', () => {
  assert.equal(scaled('1,200.50', 2), 120050n)
  assert.equal(scaled('$65', 2), 6500n)
  assert.equal(scaled('.5', 3), 500n)
  assert.equal(scaled('3.250', 2), 325n)
  assert.equal(scaled('3.255', 2), null)
  assert.equal(scaled('1e3', 2), null)
  assert.equal(scaled('-1', 2), null)
  assert.equal(scaled('', 2), null)
  assert.equal(normalNumber('1,200.50'), '1200.5')
  assert.equal(normalNumber('.5'), '0.5')
  assert.equal(normalNumber('8.'), '8')
  assert.equal(normalNumber('007'), '7')
})

test('validation uses the same limits as the server', () => {
  assert.deepEqual(validate(sample()), {})
  const form = sample()
  const [first, second, third] = form.sections[0].lines
  first.quantity = '0'
  second.unit_cost = '3.255'
  third.description = '  '
  form.markup_percent = '1000.01'
  form.tax_percent = ''
  form.sections[0].name = ''
  form.scope = ''
  const errors = validate(form)
  assert.deepEqual(Object.keys(errors).sort(), ['markup_percent', 's0.l0.quantity', 's0.l1.unit_cost', 's0.l2.description', 's0.name', 'scope', 'tax_percent'])
  assert.equal(errors['s0.l0.quantity'], 'Must be more than 0')
  assert.equal(errors['s0.l1.unit_cost'], 'Up to 2 decimal places')
  first.quantity = '1000000.001'
  assert.match(validate(form)['s0.l0.quantity'], /more than 1,000,000/)
  first.quantity = 'eight'
  assert.equal(validate(form)['s0.l0.quantity'], 'Numbers only')
})

test('server validation errors land on the same fields', () => {
  const detail = [
    { loc: ['body', 'sections', 0, 'lines', 1, 'quantity'], msg: 'Input should be greater than 0' },
    { loc: ['body', 'sections', 2, 'name'], msg: 'String should have at least 1 character' },
    { loc: ['body', 'tax_percent'], msg: 'Input should be less than or equal to 100' },
  ]
  assert.deepEqual(serverErrors(detail), {
    's0.l1.quantity': 'Input should be greater than 0',
    's2.name': 'String should have at least 1 character',
    tax_percent: 'Input should be less than or equal to 100',
  })
  assert.deepEqual(serverErrors('Estimate changed'), {})
})

test('the saved payload is trimmed and normalised', () => {
  const form = sample()
  form.sections[0].name = '  Kitchen  '
  form.sections[0].lines[1].unit_cost = '$3.250'
  form.sections[0].lines[1].quantity = '1,00'
  const payload = payloadOf(form, 4)
  assert.equal(payload.version, 4)
  assert.equal(payload.sections[0].name, 'Kitchen')
  assert.equal(payload.sections[0].lines[1].unit_cost, '3.25')
  assert.equal(payload.sections[0].lines[1].quantity, '100')
})

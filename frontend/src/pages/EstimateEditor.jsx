import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, History, Loader2, Lock, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import PriceHistorySheet from '../components/PriceHistorySheet'
import { Alert, BackLink, Field, LoadError, Loading, Tag } from '../components/ui'
import { request, send } from '../lib/api'
import { DraftContext } from '../lib/DraftContext'
import { KINDS, TAX_BASES, blankLine, editable, isBlankLine, lineKey, payloadOf, sectionKey, serverErrors, totals, validate } from '../lib/estimateMath'
import { dollars, savedAt, stampDate } from '../lib/format'
import { href, navigate } from '../lib/router'

const LINE_FIELDS = { description: 'Description', quantity: 'Quantity', unit: 'Unit', unit_cost: 'Unit cost' }

/** Saved / unsaved / saving, always in the same place and never colour alone. */
function SaveState({ approved, dirty, saving, failed, savedStamp }) {
  const [tone, Icon, text] = approved
    ? ['bg-[#E7E4E1] text-[#4A4543]', Lock, 'Approved · locked']
    : saving
      ? ['bg-[#ECE7E0] text-[#4F4943]', Loader2, 'Saving…']
      : failed
        ? ['bg-danger-tint text-danger', null, 'Not saved']
        : dirty
          ? ['bg-warn-tint text-warn', null, 'Unsaved changes']
          : ['bg-ok-tint text-ok', Check, `Saved${savedStamp ? ` ${savedAt(savedStamp)}` : ''}`]
  return (
    <span role="status" data-testid="save-state" className={`chip ${tone}`}>
      {Icon ? <Icon size={13} className={saving ? 'animate-spin' : ''} aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {text}
    </span>
  )
}

function Row({ label, value, strong, note, tag }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`min-w-0 ${strong ? 'font-semibold' : 'text-sm'}`}>
        {label}
        {tag}
        {note ? <span className="block text-xs font-normal text-steel">{note}</span> : null}
      </dt>
      <dd className={`tabular shrink-0 ${strong ? 'text-lg font-semibold' : 'text-sm'}`}>{value}</dd>
    </div>
  )
}

/** Pricing rules and the running total: what it costs you, then what the client sees. */
function Summary({ form, sum, errors, change, touch, disabled }) {
  const basis = TAX_BASES.find((entry) => entry.value === form.tax_basis)
  const margin = sum.subtotal ? ((sum.markup / sum.subtotal) * 100).toFixed(1) : null
  return (
    <aside aria-labelledby="summary-title" className="est-summary card divide-y divide-line">
      <fieldset disabled={disabled} className="min-w-0 space-y-3 p-4">
        <legend id="summary-title" className="section-title float-left mb-3 w-full">
          Pricing rules
        </legend>
        <div className="clear-both grid grid-cols-2 gap-3">
          <Field label="Markup on cost (%)" inputMode="decimal" autoComplete="off" value={form.markup_percent} error={errors.markup_percent} onBlur={() => touch('markup_percent')} onChange={(event) => change({ ...form, markup_percent: event.target.value })} />
          <Field label="Tax rate (%)" inputMode="decimal" autoComplete="off" value={form.tax_percent} error={errors.tax_percent} onBlur={() => touch('tax_percent')} onChange={(event) => change({ ...form, tax_percent: event.target.value })} />
        </div>
        <Field label="Tax applies to">
          <select className="field" value={form.tax_basis} onChange={(event) => change({ ...form, tax_basis: event.target.value })}>
            {TAX_BASES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-steel">Provisional until Anthony confirms rates and what is taxable. Each line and the tax are rounded half up to the cent.</p>
      </fieldset>

      <dl className="space-y-2 p-4">
        <p className="eyebrow mb-1 flex items-center gap-2 text-steel">
          Your cost <Tag>Internal</Tag>
        </p>
        {KINDS.map((kind) => (
          <Row key={kind.value} label={kind.plural} value={dollars(sum.byKind[kind.value])} />
        ))}
        <div className="border-t border-line pt-2">
          <Row label="Total cost" value={dollars(sum.cost)} strong />
        </div>
        <Row label={`Markup${form.markup_percent && !errors.markup_percent ? ` (${form.markup_percent}%)` : ''}`} value={`+ ${dollars(sum.markup)}`} note={margin ? `${margin}% of the selling price` : null} />
      </dl>

      <dl className="space-y-2 p-4">
        <p className="eyebrow mb-1 flex items-center gap-2 text-steel">
          Client sees <Tag tone="brand">On the estimate</Tag>
        </p>
        <Row label="Subtotal" value={dollars(sum.subtotal)} />
        <Row label={`Tax${form.tax_basis !== 'none' && form.tax_percent && !errors.tax_percent ? ` (${form.tax_percent}% ${basis.short})` : ''}`} value={dollars(sum.tax)} />
        <div className="border-t border-line pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-semibold">Client total</dt>
            <dd data-testid="client-total" className="tabular font-serif text-2xl">
              {dollars(sum.total)}
            </dd>
          </div>
        </div>
      </dl>
    </aside>
  )
}

export default function EstimateEditor({ jobId, estimateId }) {
  const [estimate, setEstimate] = useState(null)
  const [job, setJob] = useState(null)
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [failed, setFailed] = useState(false)
  const [stale, setStale] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [touched, setTouched] = useState({})
  const [fromServer, setFromServer] = useState({})
  const [undo, setUndo] = useState(null)
  const [history, setHistory] = useState(null)
  const [approver, setApprover] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const reportDirty = useContext(DraftContext)
  const focusNext = useRef(null) // CSS selector to focus after the next render
  const focusInvalid = useRef(false)
  const page = useRef(null)
  const latestForm = useRef(null)
  latestForm.current = form

  const markDirty = useCallback(
    (value) => {
      setDirty(value)
      reportDirty(value)
    },
    [reportDirty]
  )

  const load = useCallback(async () => {
    try {
      const [loaded, parent] = await Promise.all([request(`/estimates/${estimateId}`), request(`/jobs/${jobId}`)])
      if (loaded.job_id !== jobId) throw new Error('That estimate belongs to a different job.')
      setEstimate(loaded)
      setJob(parent)
      setForm(editable(loaded.document))
      setLoadError('')
      setStale(false)
      setError('')
      setFailed(false)
      setFromServer({})
      setTouched({})
      setShowAll(false)
      setUndo(null)
      markDirty(false)
    } catch (caught) {
      setLoadError(caught.message)
    }
  }, [estimateId, jobId, markDirty])

  useEffect(() => {
    load()
    return () => reportDirty(false)
  }, [load, reportDirty])

  useEffect(() => {
    const warn = (event) => {
      if (dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const approved = estimate?.state === 'approved'
  const sum = useMemo(() => (form ? totals(form) : null), [form])
  const problems = useMemo(() => (form ? validate(form) : {}), [form])
  // Show a problem once the field has been visited, or everywhere after a save attempt.
  const errors = useMemo(() => {
    const shown = { ...fromServer }
    for (const [key, message] of Object.entries(problems)) if (showAll || touched[key]) shown[key] = message
    return shown
  }, [problems, fromServer, showAll, touched])

  // After adding a line, put the cursor in its description; after a failed save, in the first problem.
  useEffect(() => {
    if (focusNext.current) {
      page.current?.querySelector(focusNext.current)?.focus()
      focusNext.current = null
    }
    if (focusInvalid.current) {
      page.current?.querySelector('[aria-invalid="true"]')?.focus()
      focusInvalid.current = false
    }
  })

  function change(next, undoable) {
    if (undoable) setUndo({ form, label: undoable })
    else if (undo) setUndo(null)
    setForm(next)
    setFromServer({})
    setFailed(false)
    if (!dirty) markDirty(true)
  }
  const touch = (key) => setTouched((current) => (current[key] ? current : { ...current, [key]: true }))
  const setSection = (si, patch) => ({ ...form, sections: form.sections.map((section, i) => (i === si ? { ...section, ...patch } : section)) })
  const setLine = (si, li, field, value) => change(setSection(si, { lines: form.sections[si].lines.map((line, j) => (j === li ? { ...line, [field]: value } : line)) }))

  function addLine(si, line = blankLine()) {
    const lines = form.sections[si].lines
    // A reused line fills the untouched starter row instead of leaving it behind.
    const replaceStarter = line.description && lines.length === 1 && isBlankLine(lines[0])
    change(setSection(si, { lines: replaceStarter ? [line] : [...lines, line] }))
    if (!line.description) focusNext.current = `[data-line="${si}-${lines.length}"] input`
  }

  const save = useCallback(async () => {
    setShowAll(true)
    const found = Object.keys(validate(form)).length
    if (found) {
      setError(`Fix the ${found === 1 ? 'highlighted field' : `${found} highlighted fields`} to save.`)
      focusInvalid.current = true
      return null
    }
    setBusy('save')
    setError('')
    setFailed(false)
    try {
      const updated = await send(`/estimates/${estimateId}`, 'PUT', payloadOf(form, estimate.version))
      setEstimate(updated)
      setShowAll(false)
      setFromServer({})
      // Typing can continue while a save is in flight; never overwrite newer edits.
      const clean = latestForm.current === form
      if (clean) {
        setForm(editable(updated.document))
        setTouched({})
        setUndo(null)
        markDirty(false)
      }
      return { clean }
    } catch (caught) {
      if (caught.status === 409) {
        setStale(true)
      } else if (caught.status === 422 && Array.isArray(caught.detail)) {
        setFromServer(serverErrors(caught.detail))
        setError(`Not saved — the server rejected a value: ${caught.message}`)
        focusInvalid.current = true
      } else {
        setFailed(true)
        setError(`Not saved. ${caught.message}`)
      }
      return null
    } finally {
      setBusy('')
    }
  }, [estimate, estimateId, form, markDirty])

  // Ctrl/⌘+S saves, as people expect in a document.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (form && !approved && !busy) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [approved, busy, form, save])

  async function act(name, action) {
    setBusy(name)
    setError('')
    try {
      await action()
    } catch (caught) {
      if (caught.status === 409 && name === 'approve') setStale(true)
      setError(caught.message)
    } finally {
      setBusy('')
    }
  }

  async function preview() {
    // Preview shows what is saved, so save first if anything changed.
    if (dirty && !(await save())?.clean) return
    navigate(`/jobs/${jobId}/estimates/${estimateId}/preview`)
  }

  const approve = () =>
    act('approve', async () => {
      const updated = await send(`/estimates/${estimateId}/approve`, 'POST', { version: estimate.version, approved_by: approver.trim(), note: note.trim() })
      setEstimate(updated)
      setConfirming(false)
      setJob(await request(`/jobs/${jobId}`))
    })
  const convert = () =>
    act('convert', async () => {
      await send(`/estimates/${estimateId}/convert`, 'POST')
      navigate(`/jobs/${jobId}`)
    })
  const revise = () =>
    act('revise', async () => {
      const next = await send(`/jobs/${jobId}/estimates`, 'POST')
      navigate(`/jobs/${jobId}/estimates/${next.id}`)
    })

  if (loadError) {
    return (
      <div className="workspace">
        <LoadError message={loadError} onRetry={load}>
          <a className="btn-ghost" href={href(`/jobs/${jobId}`)}>
            Back to job
          </a>
        </LoadError>
      </div>
    )
  }
  if (!form) {
    return (
      <div className="workspace">
        <Loading label="Opening estimate…" />
      </div>
    )
  }

  const saving = busy === 'save'
  const project = job?.project
  const isBaseline = project?.estimate_id === estimate.id
  const baselineRevision = project ? job.estimates.find((entry) => entry.id === project.estimate_id)?.revision : null
  const canApprove = !dirty && sum.total > 0 && approver.trim() && note.trim()

  function onLineKey(event, si, li) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (li === form.sections[si].lines.length - 1) addLine(si)
    else page.current?.querySelector(`[data-line="${si}-${li + 1}"] input`)?.focus()
  }

  const saveButton = (extra = '') => (
    <button type="submit" form="estimate-form" className={`btn-primary ${extra}`} disabled={!!busy} aria-keyshortcuts="Control+S">
      <Save size={16} aria-hidden="true" />
      {saving ? 'Saving…' : 'Save estimate'}
    </button>
  )

  return (
    <div className="workspace !pb-0" ref={page}>
      <div className="no-print -mx-4 px-4 pb-3 md:sticky md:top-0 md:z-20 md:-mx-8 md:bg-sand/95 md:px-8 md:pt-3 md:backdrop-blur">
        <BackLink to={`/jobs/${jobId}`}>{estimate.document.job.name}</BackLink>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="page-title">Estimate · Revision {estimate.revision}</h1>
            <SaveState approved={approved} dirty={dirty} saving={saving} failed={failed} savedStamp={estimate.document.saved_at} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={preview}>
              <Eye size={16} aria-hidden="true" />
              Client preview
            </button>
            {!approved ? saveButton('hidden md:inline-flex') : null}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {stale ? (
          <Alert message="This estimate was changed somewhere else, so this copy can’t be saved over it.">
            <button type="button" className="btn-ghost" onClick={() => (window.confirm('Load the latest saved version? Unsaved changes on this screen will be lost.') ? load() : null)}>
              Load latest version
            </button>
          </Alert>
        ) : null}
        <Alert message={error}>
          {failed ? (
            <button type="button" className="btn-ghost" onClick={save} disabled={!!busy}>
              Try again
            </button>
          ) : null}
        </Alert>
        {failed ? <p className="text-sm text-steel">Your changes are still on this screen. Nothing was lost.</p> : null}
        {undo ? (
          <Alert tone="ok" message={undo.label}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setForm(undo.form)
                setUndo(null)
              }}
            >
              <Undo2 size={15} aria-hidden="true" />
              Undo
            </button>
          </Alert>
        ) : null}

        {approved ? (
          <section aria-labelledby="approved-title" className="card border-l-4 border-ok p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0 flex-1 basis-72">
                <h2 id="approved-title" className="flex items-center gap-2 text-lg font-semibold">
                  <Lock size={17} aria-hidden="true" />
                  Approved and locked
                </h2>
                <p className="mt-1 text-sm">
                  Approval recorded for <strong>{estimate.approved_by}</strong> on {stampDate(estimate.approved_at)}.
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-steel">Evidence: {estimate.approval_note}</p>
                <p className="mt-2 text-[13px] text-steel">
                  {project && !isBaseline
                    ? `The project’s budget comes from revision ${baselineRevision}. This revision doesn’t change it automatically.`
                    : 'To change scope or price, create a new revision. This one stays as approved.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost" disabled={!!busy} onClick={revise}>
                  <Plus size={16} aria-hidden="true" />
                  {job?.estimates.some((entry) => entry.state === 'draft') ? 'Open draft revision' : 'Create revision'}
                </button>
                <button type="button" className="btn-primary" disabled={!!busy} onClick={convert}>
                  {project ? 'Open project' : 'Create project'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <div className="est-grid mt-4">
        <form
          id="estimate-form"
          noValidate
          style={{ gridArea: 'lines' }}
          className="min-w-0"
          onSubmit={(event) => {
            event.preventDefault()
            if (!approved) save()
          }}
        >
          <fieldset disabled={approved} className="est-sections min-w-0 space-y-4">
            <legend className="sr-only">Estimate details</legend>
            <Field label="Estimated scope" hint={approved ? null : 'Printed at the top of the client estimate.'} error={errors.scope}>
              <textarea className="field" rows={3} maxLength={10000} value={form.scope} onBlur={() => touch('scope')} onChange={(event) => change({ ...form, scope: event.target.value })} />
            </Field>

            {form.sections.map((section, si) => (
              <section key={si} className="card overflow-hidden" aria-label={section.name || `Section ${si + 1}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 pt-3">
                  <label className="min-w-[180px] flex-1" data-section={si}>
                    <span className="sr-only">Section {si + 1} name</span>
                    <input
                      className="cell !text-base font-semibold"
                      placeholder="Section name, e.g. Kitchen"
                      maxLength={150}
                      value={section.name}
                      aria-invalid={errors[sectionKey(si)] ? 'true' : undefined}
                      onBlur={() => touch(sectionKey(si))}
                      onChange={(event) => change(setSection(si, { name: event.target.value }))}
                    />
                  </label>
                  <p className="tabular flex items-baseline gap-3 px-2 text-sm">
                    <span className="text-steel">Cost {dollars(sum.sections[si].cost)}</span>
                    <span className="font-semibold">{dollars(sum.sections[si].price)}</span>
                  </p>
                  {form.sections.length > 1 && !approved ? (
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-md text-steel hover:bg-danger-tint hover:text-danger"
                      aria-label={`Remove section ${si + 1}`}
                      onClick={() => change({ ...form, sections: form.sections.filter((_, i) => i !== si) }, `Removed section “${section.name || si + 1}”.`)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                {errors[sectionKey(si)] ? <p className="px-5 pb-2 text-xs font-medium text-danger">{errors[sectionKey(si)]}</p> : null}

                <div className="est-head border-t border-line bg-paper px-3 py-2 text-xs font-semibold text-steel" aria-hidden="true">
                  <span className="pl-2">Description</span>
                  <span className="pl-2">Type</span>
                  <span className="pr-2 text-right">Qty</span>
                  <span className="pl-2">Unit</span>
                  <span className="pr-2 text-right">Unit cost</span>
                  <span className="pr-2 text-right">Your cost</span>
                  <span className="pr-2 text-right">Price</span>
                  <span />
                </div>

                {section.lines.map((line, li) => {
                  const lineErrors = Object.keys(LINE_FIELDS).filter((field) => errors[lineKey(si, li, field)])
                  const errorId = `line-${si}-${li}-errors`
                  const cell = (field, extra = {}) => ({
                    className: `cell ${extra.numeric ? 'tabular text-right' : ''}`,
                    value: line[field],
                    autoComplete: 'off',
                    'aria-invalid': errors[lineKey(si, li, field)] ? 'true' : undefined,
                    'aria-describedby': errors[lineKey(si, li, field)] ? errorId : undefined,
                    onBlur: () => touch(lineKey(si, li, field)),
                    onChange: (event) => setLine(si, li, field, event.target.value),
                    onKeyDown: (event) => onLineKey(event, si, li),
                  })
                  return (
                    <div key={li} className="est-line" data-line={`${si}-${li}`} role="group" aria-label={`${section.name || `Section ${si + 1}`}, line ${li + 1}`}>
                      <label className="c-desc">
                        <span className="cell-label label">Description</span>
                        <input {...cell('description')} maxLength={500} placeholder="e.g. Install floor tile" />
                      </label>
                      <label className="c-kind">
                        <span className="cell-label label">Type</span>
                        <select className="cell" value={line.kind} onChange={(event) => setLine(si, li, 'kind', event.target.value)}>
                          {KINDS.map((kind) => (
                            <option key={kind.value} value={kind.value}>
                              {kind.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-qty">
                        <span className="cell-label label">Quantity</span>
                        <input {...cell('quantity', { numeric: true })} inputMode="decimal" />
                      </label>
                      <label className="c-unit">
                        <span className="cell-label label">Unit</span>
                        <input {...cell('unit')} maxLength={30} placeholder="hour" />
                      </label>
                      <label className="c-rate">
                        <span className="cell-label label">Unit cost</span>
                        <input {...cell('unit_cost', { numeric: true })} inputMode="decimal" placeholder="0.00" />
                      </label>
                      <p className="c-cost tabular text-sm text-steel">
                        <span className="cell-label label">Your cost</span>
                        <span data-testid="line-cost">{dollars(sum.sections[si].lines[li].cost)}</span>
                      </p>
                      <p className="c-price tabular text-sm font-semibold">
                        <span className="cell-label label">Price</span>
                        <span data-testid="line-price">{dollars(sum.sections[si].lines[li].price)}</span>
                      </p>
                      <div className="c-remove">
                        {section.lines.length > 1 && !approved ? (
                          <button
                            type="button"
                            aria-label={`Remove line ${li + 1} from section ${si + 1}`}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-steel hover:bg-danger-tint hover:text-danger"
                            onClick={() => change(setSection(si, { lines: section.lines.filter((_, j) => j !== li) }), `Removed “${line.description || `line ${li + 1}`}”.`)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                      {lineErrors.length ? (
                        <p id={errorId} className="c-errors px-2 text-xs font-medium text-danger">
                          {lineErrors.map((field) => `${LINE_FIELDS[field]}: ${errors[lineKey(si, li, field)]}`).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  )
                })}

                {!approved ? (
                  <div className="flex flex-wrap gap-1 border-t border-line px-3 py-2">
                    <button type="button" className="btn-quiet" onClick={() => addLine(si)}>
                      <Plus size={16} aria-hidden="true" />
                      Add line
                    </button>
                    <button type="button" className="btn-quiet" onClick={() => setHistory(si)}>
                      <History size={16} aria-hidden="true" />
                      Add from past estimates
                    </button>
                  </div>
                ) : null}
              </section>
            ))}

            {!approved ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={form.sections.length >= 30}
                onClick={() => {
                  change({ ...form, sections: [...form.sections, { name: '', lines: [blankLine()] }] })
                  focusNext.current = `[data-section="${form.sections.length}"] input`
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Add section
              </button>
            ) : null}

            <Field label="Client-facing notes" hint={approved ? null : 'Optional. Printed under the totals on the client estimate.'} error={errors.notes}>
              <textarea className="field" rows={3} maxLength={5000} value={form.notes} onChange={(event) => change({ ...form, notes: event.target.value })} />
            </Field>
          </fieldset>
        </form>

        <div style={{ gridArea: 'summary' }} className="min-w-0">
          <Summary form={form} sum={sum} errors={errors} change={change} touch={touch} disabled={approved} />
        </div>

        {!approved ? (
          <form
            style={{ gridArea: 'approval' }}
            className="card space-y-4 p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (confirming) approve()
              else setConfirming(true)
            }}
          >
            <div>
              <h2 className="section-title">Record customer approval</h2>
              <p className="mt-1 text-sm text-steel">
                Use this once the customer has approved outside this app. It records who approved and your evidence. It does not send anything and is not an electronic signature.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Approved by" required maxLength={200} placeholder={estimate.document.job.customer.contact} value={approver} onChange={(event) => { setApprover(event.target.value); setConfirming(false) }} />
              <Field label="Approval evidence / note" required maxLength={2000} placeholder="e.g. Signed copy received by email" value={note} onChange={(event) => { setNote(event.target.value); setConfirming(false) }} />
            </div>
            {confirming ? (
              <div className="rounded-lg border border-warn/30 bg-warn-tint p-3.5">
                <p className="text-sm font-semibold text-warn">
                  Lock revision {estimate.revision} at {dollars(sum.total)}?
                </p>
                <p className="mt-1 text-sm text-warn">An approved revision can’t be edited or deleted. Changes after this need a new revision.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={!!busy || !canApprove}>
                    {busy === 'approve' ? 'Recording…' : 'Yes, record approval'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button className="btn-ghost" disabled={!!busy || !canApprove}>
                  <Lock size={16} aria-hidden="true" />
                  Record approval &amp; lock revision
                </button>
                <p className="text-sm text-steel">
                  {dirty ? 'Save your changes first.' : sum.total <= 0 ? 'Add priced lines first.' : !approver.trim() || !note.trim() ? 'Enter who approved and your evidence.' : ''}
                </p>
              </div>
            )}
          </form>
        ) : null}
      </div>

      {/* Running total that stays in view while scrolling long estimates. */}
      <div className="est-bar no-print sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-white px-4 py-2.5 md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <dl className="tabular flex min-w-0 items-baseline gap-x-6 text-sm">
            <div className="hidden sm:block">
              <dt className="inline text-steel">Your cost </dt>
              <dd className="inline font-semibold">{dollars(sum.cost)}</dd>
            </div>
            <div className="hidden sm:block">
              <dt className="inline text-steel">Markup </dt>
              <dd className="inline font-semibold">{dollars(sum.markup)}</dd>
            </div>
            <div className="hidden lg:block">
              <dt className="inline text-steel">Tax </dt>
              <dd className="inline font-semibold">{dollars(sum.tax)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="block text-xs text-steel sm:inline sm:text-sm">Client total </dt>
              <dd className="inline text-base font-semibold">{dollars(sum.total)}</dd>
            </div>
          </dl>
          {!approved ? saveButton('md:hidden') : null}
        </div>
      </div>

      {history !== null ? (
        <PriceHistorySheet
          estimateId={estimateId}
          sectionName={form.sections[history]?.name || `Section ${history + 1}`}
          onClose={() => setHistory(null)}
          onAdd={(entry) => addLine(history, { description: entry.description, kind: entry.kind, quantity: '1', unit: entry.unit, unit_cost: entry.unit_cost })}
        />
      ) : null}
    </div>
  )
}

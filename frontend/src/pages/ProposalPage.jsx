import { useCallback, useEffect, useState } from 'react'
import { EyeOff, Printer } from 'lucide-react'
import { LogoMark } from '../components/Logo'
import { BackLink, LoadError, Loading, Tag } from '../components/ui'
import { request } from '../lib/api'
import { dollars, stampDate } from '../lib/format'
import { href } from '../lib/router'

/**
 * The client-facing estimate, laid out as a letter-size document.
 * It is built only from the server's client view of the estimate, which has no
 * unit costs, markup or internal totals in it.
 */
export default function ProposalPage({ jobId, estimateId }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const loaded = await request(`/estimates/${estimateId}/preview`)
      if (loaded.job_id !== jobId) throw new Error('That estimate belongs to a different job.')
      setPreview(loaded)
      setError('')
    } catch (caught) {
      setError(caught.message)
    }
  }, [estimateId, jobId])

  useEffect(() => {
    load()
  }, [load])

  // The browser uses the page title as the suggested PDF file name.
  useEffect(() => {
    if (preview) document.title = `Estimate ${preview.id} rev ${preview.revision} - ${preview.document.job.name}`
  }, [preview])

  const back = `/jobs/${jobId}/estimates/${estimateId}`
  if (error) {
    return (
      <div className="workspace">
        <LoadError message={error} onRetry={load}>
          <a className="btn-ghost" href={href(back)}>
            Back to estimate
          </a>
        </LoadError>
      </div>
    )
  }
  if (!preview) {
    return (
      <div className="workspace">
        <Loading label="Preparing the client estimate…" />
      </div>
    )
  }

  const { job, sections, totals, notes } = preview.document
  const customer = job.customer
  const approved = preview.state === 'approved'

  return (
    <div className="workspace">
      <div className="no-print mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center justify-between gap-3">
        <BackLink to={back}>Back to estimate</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          {approved ? <Tag tone="ok">Approved revision</Tag> : <Tag tone="warn">Draft — not yet approved</Tag>}
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Print / save PDF
          </button>
        </div>
      </div>
      <p className="no-print mx-auto mb-4 flex max-w-[8.5in] items-center gap-2 text-sm text-steel">
        <EyeOff size={15} className="shrink-0" aria-hidden="true" />
        This is exactly what the client gets. Your costs and markup are not on it. Nothing is sent from here.
      </p>

      <article className="proposal card mx-auto max-w-[8.5in] px-5 py-7 sm:px-12 sm:py-12">
        <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 border-b-2 border-maroon pb-6">
          <div className="flex items-center gap-3.5">
            <LogoMark size={52} />
            <div>
              <p className="font-serif text-xl leading-tight">A E Talley Construction LLC</p>
              <p className="mt-0.5 text-sm text-steel">aetalleycms.com</p>
            </div>
          </div>
          <div className="sm:text-right">
            <h1 className="font-serif text-[32px] leading-none text-maroon">Estimate</h1>
            <dl className="tabular mt-2.5 space-y-0.5 text-sm">
              <div>
                <dt className="inline text-steel">No. </dt>
                <dd className="inline font-semibold">
                  {preview.id} · Revision {preview.revision}
                </dd>
              </div>
              <div>
                <dt className="inline text-steel">Date </dt>
                <dd className="inline font-semibold">{stampDate(preview.prepared_at)}</dd>
              </div>
            </dl>
          </div>
        </header>

        {/* min-w-0 + wrap anywhere: a long name or email wraps instead of widening the page. */}
        <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-5 [overflow-wrap:anywhere] sm:grid-cols-2">
          <section className="min-w-0">
            <h2 className="eyebrow text-steel">Prepared for</h2>
            <p className="mt-1.5 font-semibold">{customer.name}</p>
            {customer.contact !== customer.name ? <p>{customer.contact}</p> : null}
            {customer.email ? <p>{customer.email}</p> : null}
            {customer.phone ? <p>{customer.phone}</p> : null}
          </section>
          <section className="min-w-0">
            <h2 className="eyebrow text-steel">Job site</h2>
            <p className="mt-1.5 font-semibold">{job.name}</p>
            <p>{job.address}</p>
          </section>
        </div>

        <section className="keep-together mt-7">
          <h2 className="eyebrow text-steel">Scope of work</h2>
          <p className="mt-1.5 whitespace-pre-wrap break-words leading-relaxed">{job.scope}</p>
        </section>

        {sections.map((section, index) => (
          // Phones: description with quantity and unit beneath it, and the amount.
          // Wider screens and print: four fixed columns that line up across sections.
          <table key={index} className="mt-7 w-full border-collapse text-sm [overflow-wrap:anywhere] sm:table-fixed">
            <caption className="sr-only">{section.name}</caption>
            <thead>
              {/* Column headings sit on the same baseline as the section name. */}
              <tr className="border-b border-ink text-left [&>th]:align-baseline">
                <th scope="col" className="py-2 pr-3 text-base font-semibold">
                  {section.name}
                </th>
                <th scope="col" className="hidden w-[4.5rem] py-2 pr-3 text-right text-xs font-semibold text-steel sm:table-cell">
                  Qty
                </th>
                <th scope="col" className="hidden w-[5.5rem] py-2 pr-3 text-xs font-semibold text-steel sm:table-cell">
                  Unit
                </th>
                <th scope="col" className="whitespace-nowrap py-2 text-right text-xs font-semibold text-steel sm:w-[7.5rem]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {section.lines.map((line, row) => (
                <tr key={row} className="border-b border-line align-top">
                  <td className="py-2.5 pr-3">
                    {line.description}
                    <span className="block text-xs text-steel sm:hidden">
                      {line.quantity} {line.unit}
                    </span>
                  </td>
                  <td className="tabular hidden py-2.5 pr-3 text-right sm:table-cell">{line.quantity}</td>
                  <td className="hidden py-2.5 pr-3 sm:table-cell">{line.unit}</td>
                  <td className="tabular whitespace-nowrap py-2.5 text-right">{dollars(line.price_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2.5 pr-3 text-right text-steel sm:hidden">Subtotal</td>
                <td colSpan={3} className="hidden py-2.5 pr-3 text-right text-steel sm:table-cell">
                  {section.name} subtotal
                </td>
                <td className="tabular whitespace-nowrap py-2.5 text-right font-semibold">{dollars(section.price_cents)}</td>
              </tr>
            </tfoot>
          </table>
        ))}

        <dl className="keep-together tabular ml-auto mt-6 max-w-xs space-y-1.5 border-t-2 border-ink pt-4">
          <div className="flex justify-between gap-6">
            <dt>Subtotal</dt>
            <dd>{dollars(totals.subtotal_cents)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt>Tax</dt>
            <dd>{dollars(totals.tax_cents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 pt-1.5">
            <dt className="text-base font-semibold">Total</dt>
            <dd data-testid="proposal-total" className="font-serif text-[26px] leading-none">
              {dollars(totals.total_cents)}
            </dd>
          </div>
        </dl>

        {notes ? (
          <section className="keep-together mt-8">
            <h2 className="eyebrow text-steel">Notes</h2>
            <p className="mt-1.5 whitespace-pre-wrap break-words leading-relaxed">{notes}</p>
          </section>
        ) : null}

        {preview.approved_by ? (
          <p className="keep-together mt-8 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
            Approval recorded for <strong>{preview.approved_by}</strong> on {stampDate(preview.approved_at)}.
          </p>
        ) : null}

        <p className="mt-10 border-t border-line pt-4 text-xs text-steel">Demo estimate · Synthetic pricing for workflow review. Not a customer offer.</p>
      </article>
    </div>
  )
}

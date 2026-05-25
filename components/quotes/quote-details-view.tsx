'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Copy,
  Download,
  MapPin,
  Package,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  Weight,
  Building2,
  Phone,
  Mail,
} from 'lucide-react'
import type { Quote, QuoteStatus, QuoteResult } from '@/types/database'

interface QuoteDetailsViewProps {
  quote: Quote
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const config: Record<QuoteStatus, { label: string; icon: React.ElementType; className: string }> = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    },
    processing: {
      label: 'Processing',
      icon: Loader2,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    },
    completed: {
      label: 'Completed',
      icon: CheckCircle2,
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    },
    failed: {
      label: 'Failed',
      icon: AlertCircle,
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
    },
  }
  const c = config[status]
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${c.className}`}>
      <Icon className={`h-4 w-4 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm font-medium text-foreground text-right ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">Best</span>
  if (rank === 2) return <span className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">2nd</span>
  if (rank === 3) return <span className="inline-flex items-center text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">3rd</span>
  return <span className="text-xs text-muted-foreground">#{rank}</span>
}

export function QuoteDetailsView({ quote }: QuoteDetailsViewProps) {
  const [copying, setCopying] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [running, setRunning] = useState(false)

  async function runAutomation() {
    setRunning(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/run`, { method: 'POST' })
      if (res.ok) {
        toast.success('Automation started!', { description: 'Getting Echo prices… page will refresh automatically.' })
        // Reload after 3 s so status switches to "processing"
        setTimeout(() => window.location.reload(), 3000)
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
        toast.error('Could not start automation', { description: error })
        setRunning(false)
      }
    } catch {
      toast.error('Network error — make sure the app is running locally')
      setRunning(false)
    }
  }

  async function copyId() {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(quote.id)
      toast.success('Quote ID copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    } finally {
      setTimeout(() => setCopying(false), 1200)
    }
  }

  async function downloadScreenshot() {
    if (!quote.screenshot_url) return
    try {
      const response = await fetch(quote.screenshot_url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quote-${quote.id.slice(0, 8)}-screenshot.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Screenshot downloaded')
    } catch {
      toast.error('Failed to download screenshot')
    }
  }

  const results = quote.quote_results ?? []
  const hasResults = results.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header card: status + quick info */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={quote.status} />
              {quote.liftgate_required && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                  <Truck className="h-3 w-3" />
                  Liftgate Required
                </span>
              )}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{quote.customer_name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Submitted {format(new Date(quote.created_at), 'PPpp')}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">

            {/* Get Prices button — shown for pending and failed quotes */}
            {(quote.status === 'pending' || quote.status === 'failed') && (
              <button
                onClick={runAutomation}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {running
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting prices…</>
                  : <><Truck className="h-4 w-4" /> Get Prices</>
                }
              </button>
            )}

            <button
              onClick={copyId}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {copying ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copying ? 'Copied!' : 'Copy ID'}
            </button>

            {quote.screenshot_url && (
              <button
                onClick={downloadScreenshot}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download Screenshot
              </button>
            )}

            {quote.echo_quote_id && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
                Echo ID: <span className="font-mono font-medium text-foreground">{quote.echo_quote_id}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Best price highlight (if completed) */}
      {quote.status === 'completed' && quote.cheapest_price != null && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-500/25">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Best Rate Found</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">Cheapest available carrier</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Price</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(quote.cheapest_price)}
              </p>
            </div>
            {quote.cheapest_carrier && (
              <div>
                <p className="text-xs text-muted-foreground">Carrier</p>
                <p className="text-lg font-semibold text-foreground">{quote.cheapest_carrier}</p>
              </div>
            )}
            {quote.cheapest_transit_days != null && (
              <div>
                <p className="text-xs text-muted-foreground">Transit Time</p>
                <p className="text-lg font-semibold text-foreground">{quote.cheapest_transit_days} day{quote.cheapest_transit_days !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Failed / Error */}
      {quote.status === 'failed' && quote.automation_error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Automation Error</p>
              <p className="mt-1 text-sm text-muted-foreground font-mono whitespace-pre-wrap break-all">
                {quote.automation_error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shipment origin */}
        <InfoCard title="Origin">
          <div className="space-y-0.5">
            {quote.warehouse ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{quote.warehouse.name}</p>
                    <p className="text-xs text-muted-foreground">{quote.warehouse.city}, {quote.warehouse.state}</p>
                  </div>
                </div>
                {'phone' in quote.warehouse && quote.warehouse.phone && (
                  <DetailRow label="Phone" value={
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {(quote.warehouse as any).phone}
                    </span>
                  } />
                )}
                {'email' in quote.warehouse && quote.warehouse.email && (
                  <DetailRow label="Email" value={
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {(quote.warehouse as any).email}
                    </span>
                  } />
                )}
              </>
            ) : null}
            <DetailRow label="Address" value={quote.origin_address} />
            <DetailRow
              label="Location"
              value={
                quote.origin_city
                  ? `${quote.origin_city}, ${quote.origin_state} ${quote.origin_zip}`
                  : null
              }
            />
          </div>
        </InfoCard>

        {/* Destination */}
        <InfoCard title="Destination">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {quote.destination_city}, {quote.destination_state}
              </p>
              <p className="text-xs text-muted-foreground">{quote.destination_zip}</p>
            </div>
          </div>
          <DetailRow label="Street" value={quote.destination_address} />
          <DetailRow
            label="City / State / ZIP"
            value={`${quote.destination_city}, ${quote.destination_state} ${quote.destination_zip}`}
          />
        </InfoCard>

        {/* Pallet info */}
        <InfoCard title="Shipment Details">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50 p-3 text-center">
              <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{quote.qty_70kg}</p>
              <p className="text-xs text-orange-600/70 dark:text-orange-500/70 mt-0.5">70 kg</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-3 text-center">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{quote.qty_35kg}</p>
              <p className="text-xs text-blue-600/70 dark:text-blue-500/70 mt-0.5">35 kg</p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 p-3 text-center">
              <p className="text-xl font-bold text-green-700 dark:text-green-400">{quote.qty_24kg}</p>
              <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-0.5">24 kg</p>
            </div>
          </div>
          <DetailRow
            label="Total Pallets"
            value={
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                {quote.total_pallets}
              </span>
            }
          />
          <DetailRow
            label="Total Weight"
            value={
              <span className="flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                {quote.total_weight.toLocaleString('en-US')} kg
              </span>
            }
          />
          <DetailRow
            label="Pickup Date"
            value={
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {format(new Date(quote.pickup_date), 'MMMM d, yyyy')}
              </span>
            }
          />
          <DetailRow label="Liftgate" value={quote.liftgate_required ? 'Required' : 'Not required'} />
        </InfoCard>

        {/* System info */}
        <InfoCard title="System Information">
          <DetailRow label="Quote ID" value={<span className="font-mono text-xs">{quote.id}</span>} />
          <DetailRow
            label="Created"
            value={format(new Date(quote.created_at), 'PPpp')}
          />
          <DetailRow
            label="Last Updated"
            value={format(new Date(quote.updated_at), 'PPpp')}
          />
          {quote.echo_quote_id && (
            <DetailRow label="Echo Quote ID" value={<span className="font-mono text-xs">{quote.echo_quote_id}</span>} />
          )}
        </InfoCard>
      </div>

      {/* Carrier results table */}
      {hasResults && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Carrier Quotes
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{results.length} carrier{results.length !== 1 ? 's' : ''} returned rates</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Carrier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Transit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Est. Delivery</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Echo Quote ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((result: QuoteResult) => (
                  <tr
                    key={result.id}
                    className={`transition-colors ${result.rank === 1 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'hover:bg-muted/30'}`}
                  >
                    <td className="px-6 py-4">
                      <RankBadge rank={result.rank} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-foreground">{result.carrier_name}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-bold tabular-nums ${result.rank === 1 ? 'text-emerald-600 dark:text-emerald-400 text-base' : 'text-foreground'}`}>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(result.price)}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-muted-foreground">
                        {result.transit_days != null ? `${result.transit_days}d` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-muted-foreground">
                        {result.estimated_delivery_date
                          ? format(new Date(result.estimated_delivery_date), 'MMM d, yyyy')
                          : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">
                        {result.echo_quote_id ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Screenshot viewer */}
      {quote.screenshot_url && !imgError && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="text-base font-semibold text-foreground">Echo Screenshot</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Screenshot captured during automation</p>
            </div>
            <button
              onClick={downloadScreenshot}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
          <div className="p-4 bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={quote.screenshot_url}
              alt="Echo Global Logistics quote screenshot"
              className="w-full rounded-lg border border-border shadow-sm"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, Package } from 'lucide-react'
import type { Quote, QuoteStatus } from '@/types/database'

interface RecentQuotesProps {
  quotes: Quote[]
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const variants: Record<QuoteStatus, { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    },
    processing: {
      label: 'Processing',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    completed: {
      label: 'Completed',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  }
  const v = variants[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${v.className}`}>
      {v.label}
    </span>
  )
}

export function RecentQuotes({ quotes }: RecentQuotesProps) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground">Recent Quotes</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Your 5 most recent submissions</p>
        </div>
        <Link
          href="/quotes"
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No quotes yet</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
            Start by submitting your first freight quote request.
          </p>
          <Link
            href="/quotes/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            New Quote
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                  Destination
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                  Pallets
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                  Best Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                  Submitted
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotes.map((quote) => (
                <tr
                  key={quote.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground truncate max-w-[160px]">
                        {quote.customer_name}
                      </span>
                      {quote.warehouse && (
                        <span className="text-xs text-muted-foreground">
                          From: {quote.warehouse.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-foreground">
                      {quote.destination_city}, {quote.destination_state} {quote.destination_zip}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="tabular-nums text-foreground">{quote.total_pallets}</span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={quote.status} />
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    {quote.cheapest_price != null ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-primary">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(quote.cheapest_price)}
                        </span>
                        {quote.cheapest_carrier && (
                          <span className="text-xs text-muted-foreground">{quote.cheapest_carrier}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                    >
                      View
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

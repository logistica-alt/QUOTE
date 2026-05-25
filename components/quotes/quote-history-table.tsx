'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Search,
  SortAsc,
  SortDesc,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  X,
} from 'lucide-react'
import type { Quote, QuoteStatus, Warehouse } from '@/types/database'

interface SortConfig {
  field: string
  order: 'asc' | 'desc'
}

interface QuoteHistoryTableProps {
  quotes: Quote[]
  warehouses: Pick<Warehouse, 'id' | 'name'>[]
  count: number
  page: number
  pageSize: number
  currentSearch: string
  currentStatus: string
  currentSort: SortConfig
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const variants: Record<QuoteStatus, { label: string; className: string; dot: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
    processing: {
      label: 'Processing',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      dot: 'bg-blue-500',
    },
    completed: {
      label: 'Completed',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      dot: 'bg-red-500',
    },
  }
  const v = variants[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${v.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  )
}

const SORT_FIELDS = [
  { label: 'Date', field: 'created_at' },
  { label: 'Customer', field: 'customer_name' },
  { label: 'Price', field: 'cheapest_price' },
  { label: 'Pallets', field: 'total_pallets' },
]

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
]

export function QuoteHistoryTable({
  quotes,
  count,
  page,
  pageSize,
  currentSearch,
  currentStatus,
  currentSort,
}: QuoteHistoryTableProps) {
  const router = useRouter()
  const pathname = usePathname()

  const totalPages = Math.ceil(count / pageSize)

  const buildUrl = useCallback(
    (params: Record<string, string | undefined>) => {
      const sp = new URLSearchParams()
      const merged = {
        page: String(page),
        search: currentSearch,
        status: currentStatus,
        sortBy: currentSort.field,
        sortOrder: currentSort.order,
        ...params,
      }
      Object.entries(merged).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && !(k === 'page' && v === '1') && !(k === 'status' && v === 'all')) {
          sp.set(k, v)
        }
      })
      const qs = sp.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [page, currentSearch, currentStatus, currentSort, pathname]
  )

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.elements.namedItem('search') as HTMLInputElement
    router.push(buildUrl({ search: input.value, page: '1' }))
  }

  function handleSortField(field: string) {
    if (field === currentSort.field) {
      router.push(buildUrl({ sortOrder: currentSort.order === 'asc' ? 'desc' : 'asc', page: '1' }))
    } else {
      router.push(buildUrl({ sortBy: field, sortOrder: 'desc', page: '1' }))
    }
  }

  const hasActiveFilters = currentSearch !== '' || currentStatus !== 'all'

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            name="search"
            type="text"
            defaultValue={currentSearch}
            placeholder="Search customer name or ZIP code..."
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          />
        </form>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={currentStatus}
            onChange={(e) => router.push(buildUrl({ status: e.target.value, page: '1' }))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1 rounded-lg border border-input bg-background p-1">
          {SORT_FIELDS.map(({ label, field }) => {
            const isActive = currentSort.field === field
            return (
              <button
                key={field}
                onClick={() => handleSortField(field)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
                {isActive && (
                  currentSort.order === 'asc' ? (
                    <SortAsc className="h-3 w-3" />
                  ) : (
                    <SortDesc className="h-3 w-3" />
                  )
                )}
              </button>
            )
          })}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors h-10"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No quotes found</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Submit your first quote to get started.'}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/quotes/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                New Quote
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Origin → Destination
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
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                    Pickup Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground max-w-[180px] truncate">
                          {quote.customer_name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {quote.id.slice(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex flex-col text-xs">
                        {quote.warehouse ? (
                          <span className="text-foreground">{quote.warehouse.name}</span>
                        ) : (
                          <span className="text-muted-foreground">{quote.origin_city}, {quote.origin_state}</span>
                        )}
                        <span className="text-muted-foreground">
                          → {quote.destination_city}, {quote.destination_state} {quote.destination_zip}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="flex flex-col text-xs">
                        <span className="tabular-nums font-medium text-foreground">{quote.total_pallets} pallets</span>
                        <span className="text-muted-foreground">{quote.total_weight.toLocaleString('en-US')} kg</span>
                      </div>
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
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {quote.cheapest_carrier}
                            </span>
                          )}
                          {quote.cheapest_transit_days != null && (
                            <span className="text-xs text-muted-foreground">
                              {quote.cheapest_transit_days}d transit
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="flex flex-col text-xs">
                        <span className="text-foreground">
                          {format(new Date(quote.pickup_date), 'MMM d, yyyy')}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count} quotes
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background transition-colors ${
                page <= 1
                  ? 'pointer-events-none opacity-40'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              aria-disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              const isActive = pageNum === page
              return (
                <Link
                  key={pageNum}
                  href={buildUrl({ page: String(pageNum) })}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {pageNum}
                </Link>
              )
            })}

            <Link
              href={buildUrl({ page: String(page + 1) })}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background transition-colors ${
                page >= totalPages
                  ? 'pointer-events-none opacity-40'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              aria-disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { QuoteHistoryTable } from '@/components/quotes/quote-history-table'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quote History',
}

interface SearchParams {
  page?: string
  search?: string
  status?: string
  warehouse_id?: string
  sortBy?: string
  sortOrder?: string
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const pageSize = 20
  const search = searchParams.search ?? ''
  const status = searchParams.status ?? 'all'
  const sortBy = searchParams.sortBy ?? 'created_at'
  const sortOrder = (searchParams.sortOrder ?? 'desc') as 'asc' | 'desc'

  let query = supabase
    .from('quotes')
    .select('*, warehouse:warehouses(name, city, state), quote_results(*)', { count: 'exact' })
    .eq('created_by', user!.id)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,destination_zip.ilike.%${search}%,destination_city.ilike.%${search}%`
    )
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: quotes, count } = await query

  // Warehouse list for filter dropdown
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quote History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} total quote{(count ?? 0) !== 1 ? 's' : ''}
            {status !== 'all' && ` · filtered by "${status}"`}
            {search && ` · searching "${search}"`}
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Quote
        </Link>
      </div>

      {/* Table with filters */}
      <QuoteHistoryTable
        quotes={(quotes as any) ?? []}
        warehouses={warehouses ?? []}
        count={count ?? 0}
        page={page}
        pageSize={pageSize}
        currentSearch={search}
        currentStatus={status}
        currentSort={{ field: sortBy, order: sortOrder }}
      />
    </div>
  )
}

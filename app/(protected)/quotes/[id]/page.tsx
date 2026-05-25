import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuoteDetailsView } from '@/components/quotes/quote-details-view'
import { AutoRefresh } from '@/components/quotes/auto-refresh'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import type { Metadata } from 'next'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: `Quote ${params.id.slice(0, 8)}`,
  }
}

export default async function QuoteDetailsPage({ params }: PageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, warehouse:warehouses(*), quote_results(*)')
    .eq('id', params.id)
    .eq('created_by', user!.id)
    .single()

  if (!quote) notFound()

  // Sort results by rank ascending
  if (quote.quote_results && Array.isArray(quote.quote_results)) {
    quote.quote_results.sort(
      (a: { rank: number }, b: { rank: number }) => a.rank - b.rank
    )
  }

  const isProcessing = quote.status === 'pending' || quote.status === 'processing'

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/quotes"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Back to quotes"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Quote Details</h1>
            <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {params.id.slice(0, 8)}...
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {quote.customer_name} · {quote.destination_city}, {quote.destination_state}
          </p>
        </div>

        {/* Refresh button (for pending/processing quotes) */}
        {isProcessing && (
          <form action="">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </form>
        )}
      </div>

      {/* Processing banner */}
      {isProcessing && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 shrink-0">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Automation in progress
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-500/70">
              This quote is being processed. Refresh the page in a moment to see updated results.
            </p>
          </div>
        </div>
      )}

      {/* Auto-refresh every 8 s while automation is running */}
      {isProcessing && <AutoRefresh intervalMs={8000} />}

      {/* Main content */}
      <QuoteDetailsView quote={quote as any} />
    </div>
  )
}

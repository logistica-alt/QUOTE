import { createClient } from '@/lib/supabase/server'
import { NewQuoteForm } from '@/components/quotes/new-quote-form'
import Link from 'next/link'
import { ArrowLeft, PackagePlus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'New Quote',
}

export default async function NewQuotePage() {
  const supabase = createClient()
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_active', true)
    .order('country')
    .order('name')

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/quotes"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Back to quotes"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">New Quote Request</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit a shipment for LTL freight quoting via Echo Global Logistics
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground flex items-start gap-2.5">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <span className="text-xs font-bold text-primary">i</span>
        </div>
        <p className="text-sm text-muted-foreground">
          After submission, our automation will query Echo Global Logistics and return carrier
          rates within a few minutes. You&apos;ll see results on the quote details page.
        </p>
      </div>

      {/* Form */}
      <NewQuoteForm warehouses={warehouses ?? []} />
    </div>
  )
}

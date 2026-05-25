import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST: Trigger automation for a quote
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-automation-secret')
    if (secret !== process.env.AUTOMATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quote_id } = await request.json()
    if (!quote_id) {
      return NextResponse.json({ error: 'quote_id required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Update status to processing
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        status: 'processing',
        automation_started_at: new Date().toISOString(),
      })
      .eq('id', quote_id)

    if (updateError) {
      console.error('Failed to update quote status to processing:', updateError)
      throw updateError
    }

    // In production, this would:
    // 1. Send to a queue (e.g., Supabase Edge Functions, GitHub Actions webhook)
    // 2. Or spawn a child process running the automation script
    // For now, we return 202 Accepted and the automation runs externally

    return NextResponse.json(
      {
        message: 'Automation queued',
        quote_id,
        instructions:
          'Run: npx ts-node scripts/echo-automation.ts --quote-id=' + quote_id,
      },
      { status: 202 }
    )
  } catch (err) {
    console.error('Automation trigger error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Save automation results (called by the automation script)
export async function PUT(request: NextRequest) {
  try {
    const secret = request.headers.get('x-automation-secret')
    if (secret !== process.env.AUTOMATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      quote_id,
      results,
      echo_quote_id,
      screenshot_url,
      error: automationError,
    } = body

    if (!quote_id) {
      return NextResponse.json({ error: 'quote_id required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Handle automation failure
    if (automationError) {
      await supabase
        .from('quotes')
        .update({
          status: 'failed',
          automation_error: automationError,
          automation_completed_at: new Date().toISOString(),
        })
        .eq('id', quote_id)

      return NextResponse.json({ success: true })
    }

    // Validate results array
    if (!Array.isArray(results) || results.length === 0) {
      await supabase
        .from('quotes')
        .update({
          status: 'failed',
          automation_error: 'No results returned from Echo automation',
          automation_completed_at: new Date().toISOString(),
        })
        .eq('id', quote_id)

      return NextResponse.json({ success: true })
    }

    // Sort results by price ascending (cheapest first)
    const sorted = [...results].sort(
      (a: { price: number }, b: { price: number }) => a.price - b.price
    )
    const cheapest = sorted[0]

    // Update quote with summary data
    const { error: quoteUpdateError } = await supabase
      .from('quotes')
      .update({
        status: 'completed',
        echo_quote_id: echo_quote_id ?? null,
        cheapest_carrier: cheapest?.carrier_name ?? null,
        cheapest_price: cheapest?.price ?? null,
        cheapest_transit_days: cheapest?.transit_days ?? null,
        screenshot_url: screenshot_url ?? null,
        automation_completed_at: new Date().toISOString(),
        automation_error: null,
      })
      .eq('id', quote_id)

    if (quoteUpdateError) {
      console.error('Failed to update quote with results:', quoteUpdateError)
      throw quoteUpdateError
    }

    // Insert top 3 quote results
    const resultsToInsert = sorted
      .slice(0, 3)
      .map(
        (
          r: {
            carrier_name: string
            price: number
            transit_days?: number | null
            estimated_delivery_date?: string | null
            echo_quote_id?: string | null
          },
          i: number
        ) => ({
          quote_id,
          carrier_name: r.carrier_name,
          price: r.price,
          transit_days: r.transit_days ?? null,
          estimated_delivery_date: r.estimated_delivery_date ?? null,
          echo_quote_id: r.echo_quote_id ?? echo_quote_id ?? null,
          rank: i + 1,
        })
      )

    const { error: resultsInsertError } = await supabase
      .from('quote_results')
      .insert(resultsToInsert)

    if (resultsInsertError) {
      console.error('Failed to insert quote results:', resultsInsertError)
      // Non-fatal: quote is already marked completed, just log the error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Save results error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

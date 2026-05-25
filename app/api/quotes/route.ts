import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calculateShipment } from '@/lib/calculations'
import type { NewQuoteFormData } from '@/types/database'
import { isCanadianZip } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? 'all'
    const warehouse_id = searchParams.get('warehouse_id') ?? ''
    const carrier = searchParams.get('carrier') ?? ''
    const date_from = searchParams.get('date_from') ?? ''
    const date_to = searchParams.get('date_to') ?? ''
    const sortBy = (searchParams.get('sortBy') ?? 'created_at') as string
    const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

    let query = supabase
      .from('quotes')
      .select('*, warehouse:warehouses(*), quote_results(*)', { count: 'exact' })
      .eq('created_by', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (search) {
      query = query.or(
        `customer_name.ilike.%${search}%,destination_zip.ilike.%${search}%,echo_quote_id.ilike.%${search}%`
      )
    }
    if (status && status !== 'all') query = query.eq('status', status)
    if (warehouse_id) query = query.eq('origin_warehouse_id', warehouse_id)
    if (carrier) query = query.ilike('cheapest_carrier', `%${carrier}%`)
    if (date_from) query = query.gte('created_at', date_from)
    if (date_to) query = query.lte('created_at', date_to + 'T23:59:59')

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({
      data,
      count: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    })
  } catch (err) {
    console.error('GET /api/quotes error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: NewQuoteFormData = await request.json()

    // Validate Canadian zip — automation not supported for CA destinations
    const isCanada = isCanadianZip(body.destination_zip)

    // Get warehouse details
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', body.origin_warehouse_id)
      .single()

    // Calculate pallets and weight
    const calculations = calculateShipment({
      qty_70kg: body.qty_70kg,
      qty_35kg: body.qty_35kg,
      qty_24kg: body.qty_24kg,
    })

    const { data: quote, error } = await supabase
      .from('quotes')
      .insert({
        customer_name: body.customer_name,
        origin_warehouse_id: body.origin_warehouse_id,
        origin_address: warehouse?.address ?? null,
        origin_city: warehouse?.city ?? null,
        origin_state: warehouse?.state ?? null,
        origin_zip: warehouse?.zip ?? null,
        destination_address: body.destination_address,
        destination_city: body.destination_city,
        destination_state: body.destination_state,
        destination_zip: body.destination_zip,
        pickup_date: body.pickup_date,
        qty_70kg: body.qty_70kg,
        qty_35kg: body.qty_35kg,
        qty_24kg: body.qty_24kg,
        total_pallets: calculations.total_pallets,
        total_weight: calculations.total_weight,
        liftgate_required: body.liftgate_required,
        status: 'pending',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Trigger automation for USA quotes only
    if (!isCanada && quote) {
      // Fire and forget — trigger automation in background
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': process.env.AUTOMATION_SECRET ?? '',
        },
        body: JSON.stringify({ quote_id: quote.id }),
      }).catch(console.error)
    }

    return NextResponse.json({ data: quote, error: null }, { status: 201 })
  } catch (err) {
    console.error('POST /api/quotes error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

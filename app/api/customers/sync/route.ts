import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchSheetCustomers } from '@/lib/google-sheets'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!
const SHEET_GID      = process.env.GOOGLE_SHEETS_GID!

/**
 * POST /api/customers/sync
 * Pulls all customers from Google Sheets and upserts them into Supabase.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check — any authenticated user can trigger a sync
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!SPREADSHEET_ID || !SHEET_GID) {
      return NextResponse.json(
        { error: 'Google Sheets environment variables not configured (GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_GID)' },
        { status: 500 }
      )
    }

    // Fetch from Google Sheets
    const customers = await fetchSheetCustomers(SPREADSHEET_ID, SHEET_GID)

    if (customers.length === 0) {
      return NextResponse.json({ message: 'No customers found in sheet', synced: 0 })
    }

    // Use service client to bypass RLS for bulk upsert
    const serviceClient = createServiceClient()

    const now = new Date().toISOString()
    const rows = customers.map(c => ({
      company_name:      c.company_name,
      full_address:      c.full_address || null,
      street:            c.street       || null,
      city:              c.city         || null,
      state:             c.state        || null,
      zip:               c.zip          || null,
      country:           c.country,
      contact_name:      c.contact_name || null,
      phone:             c.phone        || null,
      preferred_carrier: c.preferred_carrier || null,
      notes:             c.notes        || null,
      sheets_row:        c.sheets_row,
      last_synced_at:    now,
      is_active:         true,
    }))

    // Deduplicate using normalized key (lowercase + collapsed whitespace)
    // so that "DARK MOON" and "dark moon" or "DARK  MOON" count as the same.
    const dedupedMap = new Map<string, typeof rows[0]>()
    for (const row of rows) {
      const key = row.company_name.toLowerCase().replace(/\s+/g, ' ').trim()
      if (!dedupedMap.has(key)) dedupedMap.set(key, row)
    }
    const dedupedRows = Array.from(dedupedMap.values())

    // Upsert ONE ROW AT A TIME in parallel groups of 20.
    // Batch upserts fail when two rows map to the same DB constraint (e.g. Unicode
    // variants that look identical). Individual upserts are immune to that.
    const PARALLEL = 20
    let synced = 0
    let errors = 0

    for (let i = 0; i < dedupedRows.length; i += PARALLEL) {
      const slice = dedupedRows.slice(i, i + PARALLEL)
      const results = await Promise.all(
        slice.map(row =>
          serviceClient
            .from('customers')
            .upsert(row, { onConflict: 'company_name', ignoreDuplicates: false })
        )
      )
      for (const { error } of results) {
        if (error) {
          console.error('Row upsert error:', error.message)
          errors++
        } else {
          synced++
        }
      }
    }

    // Deactivate records not touched in this sync (stale / bad data)
    await serviceClient
      .from('customers')
      .update({ is_active: false })
      .lt('last_synced_at', now)

    return NextResponse.json({
      message: `Sync complete`,
      synced,
      errors,
      total: dedupedRows.length,
      raw_total: customers.length,
      timestamp: now,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Customer sync error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/customers/sync
 * Returns sync status: last sync time and total customer count.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { count } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const { data: lastSync } = await supabase
      .from('customers')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .single()

    const { data: countryCounts } = await supabase
      .from('customers')
      .select('country')
      .eq('is_active', true)

    const byCountry: Record<string, number> = {}
    countryCounts?.forEach(r => {
      byCountry[r.country] = (byCountry[r.country] ?? 0) + 1
    })

    return NextResponse.json({
      total: count ?? 0,
      last_synced_at: lastSync?.last_synced_at ?? null,
      by_country: byCountry,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/customers?search=mirror&limit=10
 * Search customers by company name for autocomplete.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search  = searchParams.get('search')?.trim() ?? ''
    const limit   = Math.min(parseInt(searchParams.get('limit') ?? '10'), 30)
    const country = searchParams.get('country') ?? '' // filter by country if needed

    if (search.length < 1) {
      return NextResponse.json({ data: [] })
    }

    let query = supabase
      .from('customers')
      .select('id, company_name, full_address, street, city, state, zip, country, contact_name, phone, preferred_carrier')
      .eq('is_active', true)
      .ilike('company_name', `%${search}%`)
      .order('company_name')
      .limit(limit)

    if (country) {
      query = query.eq('country', country)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('GET /api/customers error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

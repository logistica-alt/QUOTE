import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('quotes')
      .select('*, warehouse:warehouses(*), quote_results(*)')
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/quotes/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // This endpoint is called by the automation service OR authenticated users
    const secret = request.headers.get('x-automation-secret')

    if (secret !== process.env.AUTOMATION_SECRET) {
      // Fall back to user-authenticated update
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const body = await request.json()

      const { data, error } = await supabase
        .from('quotes')
        .update(body)
        .eq('id', params.id)
        .eq('created_by', user.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    // Automation secret authenticated — use service client (bypasses RLS)
    const supabase = createServiceClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('quotes')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/quotes/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', params.id)
      .eq('created_by', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/quotes/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DashboardStats } from '@/types/database'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all quotes for the current user
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('*, warehouse:warehouses(name, code), quote_results(*)')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Dashboard stats fetch error:', error)
      throw error
    }

    const allQuotes = quotes ?? []

    // ── Basic counts ──────────────────────────────────────────
    const total_quotes = allQuotes.length
    const completed_quotes = allQuotes.filter((q) => q.status === 'completed').length
    const pending_quotes = allQuotes.filter(
      (q) => q.status === 'pending' || q.status === 'processing'
    ).length
    const failed_quotes = allQuotes.filter((q) => q.status === 'failed').length

    // ── Weight shipped (completed only) ───────────────────────
    const completedQuotes = allQuotes.filter((q) => q.status === 'completed')
    const total_weight_shipped = completedQuotes.reduce(
      (sum, q) => sum + (q.total_weight ?? 0),
      0
    )

    // ── Average cheapest price (completed with a price) ───────
    const quotesWithPrice = completedQuotes.filter(
      (q) => q.cheapest_price != null && q.cheapest_price > 0
    )
    const avg_cheapest_price =
      quotesWithPrice.length > 0
        ? quotesWithPrice.reduce((sum, q) => sum + (q.cheapest_price ?? 0), 0) /
          quotesWithPrice.length
        : 0

    // ── Quotes this month ─────────────────────────────────────
    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd = endOfMonth(now).toISOString()
    const quotes_this_month = allQuotes.filter(
      (q) => q.created_at >= monthStart && q.created_at <= monthEnd
    ).length

    // ── Top carriers (from completed quotes) ──────────────────
    const carrierMap = new Map<string, { count: number; totalPrice: number }>()
    for (const q of completedQuotes) {
      if (!q.cheapest_carrier) continue
      const existing = carrierMap.get(q.cheapest_carrier)
      if (existing) {
        existing.count += 1
        existing.totalPrice += q.cheapest_price ?? 0
      } else {
        carrierMap.set(q.cheapest_carrier, {
          count: 1,
          totalPrice: q.cheapest_price ?? 0,
        })
      }
    }
    const top_carriers = Array.from(carrierMap.entries())
      .map(([carrier, { count, totalPrice }]) => ({
        carrier,
        count,
        avg_price: count > 0 ? Math.round((totalPrice / count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // ── Monthly volume (last 6 months) ────────────────────────
    const monthly_volume: Array<{ month: string; count: number }> = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const start = startOfMonth(monthDate).toISOString()
      const end = endOfMonth(monthDate).toISOString()
      const count = allQuotes.filter(
        (q) => q.created_at >= start && q.created_at <= end
      ).length
      monthly_volume.push({
        month: format(monthDate, 'MMM yyyy'),
        count,
      })
    }

    // ── Top origin warehouses ─────────────────────────────────
    const warehouseMap = new Map<string, number>()
    for (const q of allQuotes) {
      const warehouseName =
        (q.warehouse as { name?: string } | null)?.name ?? q.origin_city ?? 'Unknown'
      warehouseMap.set(warehouseName, (warehouseMap.get(warehouseName) ?? 0) + 1)
    }
    const top_origins = Array.from(warehouseMap.entries())
      .map(([warehouse, count]) => ({ warehouse, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const stats: DashboardStats = {
      total_quotes,
      completed_quotes,
      pending_quotes,
      failed_quotes,
      total_weight_shipped: Math.round(total_weight_shipped * 100) / 100,
      avg_cheapest_price: Math.round(avg_cheapest_price * 100) / 100,
      quotes_this_month,
      top_carriers,
      monthly_volume,
      top_origins,
    }

    return NextResponse.json({ data: stats })
  } catch (err) {
    console.error('GET /api/dashboard/stats error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { StatsGrid } from '@/components/dashboard/stats-grid'
import { RecentQuotes } from '@/components/dashboard/recent-quotes'
import { MonthlyChart } from '@/components/dashboard/monthly-chart'
import { TopCarriers } from '@/components/dashboard/top-carriers'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch recent quotes with relations
  const { data: recentQuotes } = await supabase
    .from('quotes')
    .select('*, warehouse:warehouses(name, city, state), quote_results(*)')
    .eq('created_by', user!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Total quotes count
  const { count: totalQuotes } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user!.id)

  // Completed quotes count
  const { count: completedQuotes } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user!.id)
    .eq('status', 'completed')

  // Pending/processing count
  const { count: pendingQuotes } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user!.id)
    .in('status', ['pending', 'processing'])

  // Monthly volume — last 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: monthlyData } = await supabase
    .from('quotes')
    .select('created_at, cheapest_price')
    .eq('created_by', user!.id)
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at')

  // Carrier data for stats + top carriers
  const { data: carrierData } = await supabase
    .from('quotes')
    .select('cheapest_carrier, cheapest_price')
    .eq('created_by', user!.id)
    .eq('status', 'completed')
    .not('cheapest_carrier', 'is', null)

  // Compute avg price
  const avgPrice =
    carrierData && carrierData.length > 0
      ? carrierData.reduce((sum, q) => sum + (q.cheapest_price ?? 0), 0) / carrierData.length
      : 0

  const stats = {
    totalQuotes: totalQuotes ?? 0,
    completedQuotes: completedQuotes ?? 0,
    pendingQuotes: pendingQuotes ?? 0,
    avgPrice,
  }

  // Process carrier frequency for top carriers
  const carrierMap: Record<string, { count: number; total: number }> = {}
  carrierData?.forEach((q) => {
    if (q.cheapest_carrier) {
      if (!carrierMap[q.cheapest_carrier]) {
        carrierMap[q.cheapest_carrier] = { count: 0, total: 0 }
      }
      carrierMap[q.cheapest_carrier].count++
      carrierMap[q.cheapest_carrier].total += q.cheapest_price ?? 0
    }
  })
  const topCarriers = Object.entries(carrierMap)
    .map(([carrier, data]) => ({
      carrier,
      count: data.count,
      avg_price: data.total / data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Process monthly chart data
  const monthlyMap: Record<string, number> = {}
  monthlyData?.forEach((q) => {
    const month = q.created_at.slice(0, 7)
    monthlyMap[month] = (monthlyMap[month] ?? 0) + 1
  })
  const chartData = Object.entries(monthlyMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of your freight quoting activity
        </p>
      </div>

      {/* Stats row */}
      <StatsGrid stats={stats} />

      {/* Chart + Carriers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyChart data={chartData} />
        </div>
        <div>
          <TopCarriers carriers={topCarriers} />
        </div>
      </div>

      {/* Recent quotes table */}
      <RecentQuotes quotes={(recentQuotes as any) ?? []} />
    </div>
  )
}

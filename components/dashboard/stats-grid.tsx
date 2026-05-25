'use client'

import { FileText, CheckCircle2, Clock, DollarSign, TrendingUp } from 'lucide-react'

interface StatsGridProps {
  stats: {
    totalQuotes: number
    completedQuotes: number
    pendingQuotes: number
    avgPrice: number
  }
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  accentColor: string
  trend?: { value: string; positive: boolean }
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, accentColor, trend }: StatCardProps) {
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              <TrendingUp className="h-3 w-3" />
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
      {/* Bottom accent bar */}
      <div className={`absolute bottom-0 left-0 h-0.5 w-full ${accentColor}`} />
    </div>
  )
}

export function StatsGrid({ stats }: StatsGridProps) {
  const successRate = stats.totalQuotes > 0
    ? Math.round((stats.completedQuotes / stats.totalQuotes) * 100)
    : 0

  const cards: StatCardProps[] = [
    {
      title: 'Total Quotes',
      value: stats.totalQuotes.toLocaleString('en-US'),
      subtitle: 'All time',
      icon: FileText,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-950/50',
      accentColor: 'bg-blue-500',
    },
    {
      title: 'Completed',
      value: stats.completedQuotes.toLocaleString('en-US'),
      subtitle: `${successRate}% success rate`,
      icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
      accentColor: 'bg-emerald-500',
    },
    {
      title: 'Pending / Processing',
      value: stats.pendingQuotes.toLocaleString('en-US'),
      subtitle: 'Awaiting results',
      icon: Clock,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-950/50',
      accentColor: 'bg-amber-500',
    },
    {
      title: 'Avg. Cheapest Price',
      value: stats.avgPrice > 0
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.avgPrice)
        : '—',
      subtitle: 'Per completed quote',
      icon: DollarSign,
      iconColor: 'text-violet-600 dark:text-violet-400',
      iconBg: 'bg-violet-50 dark:bg-violet-950/50',
      accentColor: 'bg-violet-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  )
}

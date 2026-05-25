'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface ChartDataPoint {
  month: string
  count: number
}

interface MonthlyChartProps {
  data: ChartDataPoint[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-primary font-semibold mt-0.5">{payload[0].value} quote{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

function formatMonth(month: string): string {
  try {
    return format(parseISO(`${month}-01`), 'MMM yy')
  } catch {
    return month
  }
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }))

  const isEmpty = data.length === 0

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground">Monthly Quote Volume</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Number of quotes submitted over time</p>
      </div>

      {isEmpty ? (
        <div className="flex h-48 items-center justify-center text-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">No data yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Submit your first quote to see volume trends</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

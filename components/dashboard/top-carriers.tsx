'use client'

import { Truck } from 'lucide-react'

interface TopCarrier {
  carrier: string
  count: number
  avg_price: number
}

interface TopCarriersProps {
  carriers: TopCarrier[]
}

const CARRIER_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
]

export function TopCarriers({ carriers }: TopCarriersProps) {
  const maxCount = carriers.length > 0 ? Math.max(...carriers.map((c) => c.count)) : 1

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Top Carriers</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Most selected by your quotes</p>
      </div>

      {carriers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <Truck className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No carrier data</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Complete some quotes to see carriers</p>
        </div>
      ) : (
        <div className="space-y-4">
          {carriers.map((carrier, index) => {
            const barWidth = Math.round((carrier.count / maxCount) * 100)
            const colorClass = CARRIER_COLORS[index % CARRIER_COLORS.length]

            return (
              <div key={carrier.carrier} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex h-2 w-2 shrink-0 rounded-full ${colorClass}`} />
                    <span className="font-medium text-foreground truncate">{carrier.carrier}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }).format(carrier.avg_price)} avg
                    </span>
                    <span className="text-xs font-semibold text-foreground w-6 text-right">
                      {carrier.count}
                    </span>
                  </div>
                </div>
                {/* Bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {carriers.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Based on {carriers.reduce((a, b) => a + b.count, 0)} completed quotes</span>
        </div>
      )}
    </div>
  )
}

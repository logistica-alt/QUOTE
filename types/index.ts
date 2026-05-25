export type QuoteStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Quote {
  id: string
  customer_name: string
  origin_warehouse_id: string | null
  origin_address: string | null
  origin_city: string | null
  origin_state: string | null
  origin_zip: string | null
  destination_address: string
  destination_city: string
  destination_state: string
  destination_zip: string
  pickup_date: string
  qty_70kg: number
  qty_35kg: number
  qty_24kg: number
  total_pallets: number
  total_weight: number
  liftgate_required: boolean
  status: QuoteStatus
  echo_quote_id: string | null
  cheapest_carrier: string | null
  cheapest_price: number | null
  cheapest_transit_days: number | null
  screenshot_url: string | null
  automation_error: string | null
  created_by: string
  created_at: string
  updated_at: string
  warehouse?: Warehouse
  quote_results?: QuoteResult[]
}

export interface Warehouse {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  zip: string
  phone: string | null
  email: string | null
  contact_person: string | null
  country: string
  is_active: boolean
}

export interface QuoteResult {
  id: string
  quote_id: string
  carrier_name: string
  price: number
  transit_days: number | null
  estimated_delivery_date: string | null
  echo_quote_id: string | null
  rank: number
  created_at: string
}

export interface DashboardStats {
  totalQuotes: number
  completedQuotes: number
  pendingQuotes: number
  avgPrice: number
}

export interface TopCarrier {
  carrier: string
  count: number
  avg_price: number
}

export interface ChartDataPoint {
  month: string
  count: number
}

export interface SortConfig {
  field: string
  order: 'asc' | 'desc'
}

export type QuoteStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Warehouse {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  zip: string
  phone: string | null
  fax: string | null
  email: string | null
  contact_person: string | null
  country: string
  is_active: boolean
  created_at: string
}

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
  automation_started_at: string | null
  automation_completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  warehouse?: Warehouse
  quote_results?: QuoteResult[]
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

export interface Screenshot {
  id: string
  quote_id: string
  storage_path: string
  public_url: string
  file_size: number | null
  created_at: string
}

// Form types
export interface NewQuoteFormData {
  customer_name: string
  origin_warehouse_id: string
  destination_address: string
  destination_city: string
  destination_state: string
  destination_zip: string
  pickup_date: string
  qty_70kg: number
  qty_35kg: number
  qty_24kg: number
  liftgate_required: boolean
}

// Dashboard stats
export interface DashboardStats {
  total_quotes: number
  completed_quotes: number
  pending_quotes: number
  failed_quotes: number
  total_weight_shipped: number
  avg_cheapest_price: number
  quotes_this_month: number
  top_carriers: Array<{ carrier: string; count: number; avg_price: number }>
  monthly_volume: Array<{ month: string; count: number }>
  top_origins: Array<{ warehouse: string; count: number }>
}

// API response types
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

// Quote filters
export interface QuoteFilters {
  search?: string
  status?: QuoteStatus | 'all'
  warehouse_id?: string
  carrier?: string
  date_from?: string
  date_to?: string
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'cheapest_price' | 'customer_name' | 'total_pallets'
  sortOrder?: 'asc' | 'desc'
}

export type Database = {
  public: {
    Tables: {
      warehouses: {
        Row: Warehouse
        Insert: Omit<Warehouse, 'id' | 'created_at'>
        Update: Partial<Omit<Warehouse, 'id' | 'created_at'>>
      }
      quotes: {
        Row: Quote
        Insert: Omit<Quote, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Quote, 'id' | 'created_at'>>
      }
      quote_results: {
        Row: QuoteResult
        Insert: Omit<QuoteResult, 'id' | 'created_at'>
        Update: Partial<Omit<QuoteResult, 'id' | 'created_at'>>
      }
      screenshots: {
        Row: Screenshot
        Insert: Omit<Screenshot, 'id' | 'created_at'>
        Update: Partial<Omit<Screenshot, 'id' | 'created_at'>>
      }
    }
  }
}

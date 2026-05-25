'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2,
  Package,
  MapPin,
  Calendar,
  Weight,
  ChevronRight,
  Info,
  Plus,
  Minus,
  Building2,
  User,
  Truck,
  Layers,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { cn, isCanadianZip } from '@/lib/utils'
import type { Warehouse } from '@/types/database'
import { CustomerSearch, type CustomerOption } from './customer-search'

// ─── Calculation helpers ─────────────────────────────────────────────────────

function calculatePallets(qty70: number, qty35: number, qty24: number): number {
  return Math.ceil((qty70 / 10) + (qty35 / 12) + (qty24 / 50)) || 0
}

function calculateWeight(qty70: number, qty35: number, qty24: number): number {
  return Math.round(((qty70 * 154.32) + (qty35 * 77.16) + (qty24 * 52.91)) * 100) / 100
}

// ─── Validation schema ────────────────────────────────────────────────────────

const newQuoteSchema = z.object({
  customer_name: z.string().min(2, 'Customer name must be at least 2 characters').max(100),
  origin_warehouse_id: z.string().min(1, 'Please select an origin warehouse'),
  destination_address: z.string().min(5, 'Address is required'),
  destination_city: z.string().min(2, 'City is required'),
  destination_state: z.string().length(2, 'Enter 2-letter state code (e.g. CA)'),
  destination_zip: z
    .string()
    .regex(
      /^(\d{5}(-\d{4})?|[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d)$/,
      'Enter a valid US (5-digit) or Canadian postal code'
    ),
  pickup_date: z.string().min(1, 'Pickup date is required').refine((val) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(val) >= today
  }, 'Pickup date must be today or in the future'),
  qty_70kg: z.coerce.number().int().min(0, 'Must be 0 or more').max(9999),
  qty_35kg: z.coerce.number().int().min(0, 'Must be 0 or more').max(9999),
  qty_24kg: z.coerce.number().int().min(0, 'Must be 0 or more').max(9999),
  liftgate_required: z.boolean(),
}).refine(
  (data) => data.qty_70kg + data.qty_35kg + data.qty_24kg > 0,
  {
    message: 'At least one quantity must be greater than 0',
    path: ['qty_70kg'],
  }
)

type NewQuoteFormData = z.infer<typeof newQuoteSchema>

interface NewQuoteFormProps {
  warehouses: Warehouse[]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, description, children }: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, error, required, hint, children }: {
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1 text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive">*</span>}
          {hint && <span className="ml-1 text-xs text-muted-foreground font-normal">({hint})</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <Info className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

const inputCls = [
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
].join(' ')

function QtySpinner({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || value === 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={0}
        max={9999}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        disabled={disabled}
        className={cn(inputCls, 'text-center tabular-nums font-semibold')}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function NewQuoteForm({ warehouses }: NewQuoteFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [customerSearchValue, setCustomerSearchValue] = useState('')
  const [autoFilledFromDB, setAutoFilledFromDB] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<NewQuoteFormData>({
    resolver: zodResolver(newQuoteSchema),
    defaultValues: {
      customer_name: '',
      origin_warehouse_id: '',
      destination_address: '',
      destination_city: '',
      destination_state: '',
      destination_zip: '',
      pickup_date: todayStr,
      qty_70kg: 0,
      qty_35kg: 0,
      qty_24kg: 0,
      liftgate_required: false,
    },
  })

  const warehouseId = watch('origin_warehouse_id')
  const qty70 = Number(watch('qty_70kg') ?? 0)
  const qty35 = Number(watch('qty_35kg') ?? 0)
  const qty24 = Number(watch('qty_24kg') ?? 0)
  const destZip = watch('destination_zip') || ''
  const liftgate = watch('liftgate_required')

  const pallets = calculatePallets(qty70, qty35, qty24)
  const weight = calculateWeight(qty70, qty35, qty24)
  const hasProducts = qty70 > 0 || qty35 > 0 || qty24 > 0
  const isCanadian = isCanadianZip(destZip)

  useEffect(() => {
    if (warehouseId) {
      setSelectedWarehouse(warehouses.find((w) => w.id === warehouseId) || null)
    } else {
      setSelectedWarehouse(null)
    }
  }, [warehouseId, warehouses])

  // Handle customer selection from autocomplete
  const handleCustomerSelect = useCallback(async (customer: CustomerOption | null) => {
    if (!customer) {
      setAutoFilledFromDB(false)
      return
    }

    setValue('customer_name', customer.company_name, { shouldValidate: true })
    setCustomerSearchValue(customer.company_name)

    const street = customer.street || (customer as any).full_address || ''
    let city     = customer.city  || ''
    let state    = customer.state || ''
    const zip    = customer.zip   || ''

    if (street) setValue('destination_address', street, { shouldValidate: true })
    if (zip)    setValue('destination_zip',     zip,    { shouldValidate: true })

    // If city is missing, look up city (and state) from ZIP code
    if (/^\d{5}$/.test(zip) && !city) {
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
        if (res.ok) {
          const json = await res.json()
          const place = json?.places?.[0]
          if (place) {
            city  = place['place name']         || city
            state = place['state abbreviation'] || state
          }
        }
      } catch {
        // Silently ignore — user can fill manually
      }
    }

    if (city)  setValue('destination_city',  city,  { shouldValidate: true })
    if (state) setValue('destination_state', state, { shouldValidate: true })

    setAutoFilledFromDB(true)

    const filledCount = [street, city, state, zip].filter(Boolean).length
    if (filledCount >= 3) {
      toast.success(`✓ ${customer.company_name}`, {
        description: `${city}${state ? ', ' + state : ''}${zip ? ' ' + zip : ''} — revisado`,
      })
    } else if (filledCount > 0) {
      toast.info(`Datos parciales — ${customer.company_name}`, {
        description: 'Completa los campos de destino que faltan.',
      })
    } else {
      toast.warning(`Cliente encontrado — dirección incompleta`, {
        description: 'Llena los campos de destino manualmente.',
      })
    }
  }, [setValue])

  async function onSubmit(data: NewQuoteFormData) {
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in to submit a quote.')
        return
      }

      const wh = warehouses.find((w) => w.id === data.origin_warehouse_id)

      const { data: quote, error } = await supabase
        .from('quotes')
        .insert({
          customer_name: data.customer_name,
          origin_warehouse_id: data.origin_warehouse_id,
          origin_address: wh?.address ?? null,
          origin_city: wh?.city ?? null,
          origin_state: wh?.state ?? null,
          origin_zip: wh?.zip ?? null,
          destination_address: data.destination_address,
          destination_city: data.destination_city,
          destination_state: data.destination_state.toUpperCase(),
          destination_zip: data.destination_zip,
          pickup_date: data.pickup_date,
          qty_70kg: data.qty_70kg,
          qty_35kg: data.qty_35kg,
          qty_24kg: data.qty_24kg,
          total_pallets: pallets,
          total_weight: weight,
          liftgate_required: data.liftgate_required,
          status: 'pending',
          echo_quote_id: null,
          cheapest_carrier: null,
          cheapest_price: null,
          cheapest_transit_days: null,
          screenshot_url: null,
          automation_error: null,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) {
        toast.error(`Failed to submit quote: ${error.message}`)
        return
      }

      toast.success('Quote submitted!', {
        description: 'Getting Echo prices now…',
      })

      // Fire automation in background — don't block navigation
      fetch(`/api/quotes/${quote.id}/run`, { method: 'POST' }).catch(() => {})

      router.push(`/quotes/${quote.id}`)
      router.refresh()
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeWarehouses = warehouses.filter((w) => (w as any).is_active !== false)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-3xl">

      {/* ── Section 1: Customer ── */}
      <SectionCard icon={User} title="Customer Information" description="Search existing customer or type a new one">

        {/* Smart customer search */}
        <Field
          label="Search Customer"
          hint="type 2+ letters to search database"
        >
          <CustomerSearch
            value={customerSearchValue}
            onValueChange={(v) => {
              setCustomerSearchValue(v)
              // If user clears after auto-fill, also clear customer_name
              if (!v) setValue('customer_name', '')
            }}
            onCustomerSelect={handleCustomerSelect}
            placeholder="Start typing company name…"
            disabled={isSubmitting}
          />
        </Field>

        {/* Manual customer name — shown when not auto-filled OR for correction */}
        <Field label="Customer Name" error={errors.customer_name?.message} required>
          <div className="relative">
            <input
              {...register('customer_name')}
              type="text"
              placeholder="Confirm or type customer name"
              className={cn(
                inputCls,
                errors.customer_name && 'border-destructive',
                autoFilledFromDB && 'border-primary/40 bg-primary/5'
              )}
              disabled={isSubmitting}
              onChange={(e) => {
                register('customer_name').onChange(e)
                if (autoFilledFromDB) setAutoFilledFromDB(false)
              }}
            />
            {autoFilledFromDB && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary text-xs font-medium">
                <Sparkles className="h-3 w-3" />
                Auto-filled
              </div>
            )}
          </div>
        </Field>
      </SectionCard>

      {/* ── Section 2: Origin ── */}
      <SectionCard icon={Building2} title="Origin Warehouse" description="Which Forest Coffee warehouse is shipping?">
        <Field label="Warehouse" error={errors.origin_warehouse_id?.message} required>
          <select
            {...register('origin_warehouse_id')}
            className={cn(inputCls, errors.origin_warehouse_id && 'border-destructive')}
            disabled={isSubmitting}
          >
            <option value="">Select a warehouse…</option>
            {activeWarehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} — {wh.city}, {wh.state}
                {wh.country === 'CA' ? ' (Canada - Manual Only)' : ''}
              </option>
            ))}
          </select>
        </Field>

        {selectedWarehouse && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30 p-4">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-0.5 text-sm">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {selectedWarehouse.name}
                </p>
                <p className="text-emerald-700 dark:text-emerald-300">{selectedWarehouse.address}</p>
                <p className="text-emerald-700 dark:text-emerald-300">
                  {selectedWarehouse.city}, {selectedWarehouse.state} {selectedWarehouse.zip}
                  {selectedWarehouse.country !== 'US' && ` · ${selectedWarehouse.country}`}
                </p>
                {selectedWarehouse.phone && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{selectedWarehouse.phone}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Section 3: Destination ── */}
      <SectionCard icon={MapPin} title="Destination" description="Where is this shipment going?">
        <Field label="Street Address" error={errors.destination_address?.message} required>
          <input
            {...register('destination_address')}
            type="text"
            placeholder="e.g. 123 Main St"
            className={cn(inputCls, errors.destination_address && 'border-destructive')}
            disabled={isSubmitting}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <Field label="City" error={errors.destination_city?.message} required>
              <input
                {...register('destination_city')}
                type="text"
                placeholder="e.g. Los Angeles"
                className={cn(inputCls, errors.destination_city && 'border-destructive')}
                disabled={isSubmitting}
              />
            </Field>
          </div>
          <Field label="State" error={errors.destination_state?.message} required hint="2-letter">
            <input
              {...register('destination_state', { setValueAs: (v: string) => v.toUpperCase() })}
              type="text"
              placeholder="CA"
              maxLength={2}
              className={cn(inputCls, 'uppercase', errors.destination_state && 'border-destructive')}
              disabled={isSubmitting}
            />
          </Field>
          <Field label="ZIP / Postal Code" error={errors.destination_zip?.message} required>
            <input
              {...register('destination_zip')}
              type="text"
              placeholder="90001"
              maxLength={10}
              className={cn(inputCls, errors.destination_zip && 'border-destructive')}
              disabled={isSubmitting}
            />
          </Field>
        </div>

        {isCanadian && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Canadian destination detected.</span>{' '}
                Canadian shipments are saved but not automated — please handle manually.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Section 4: Pickup Date ── */}
      <SectionCard icon={Calendar} title="Pickup Date" description="When should the freight be picked up?">
        <div className="max-w-xs">
          <Field label="Requested Pickup Date" error={errors.pickup_date?.message} required>
            <input
              {...register('pickup_date')}
              type="date"
              min={todayStr}
              className={cn(inputCls, errors.pickup_date && 'border-destructive')}
              disabled={isSubmitting}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 5: Products ── */}
      <SectionCard icon={Package} title="Product Quantities" description="How many bags or boxes are being shipped?">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {/* 70 kg bags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">70 kg Bags</p>
                <p className="text-xs text-muted-foreground">154.32 lbs each</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <Controller
              name="qty_70kg"
              control={control}
              render={({ field }) => (
                <QtySpinner
                  value={Number(field.value) || 0}
                  onChange={(v) => field.onChange(v)}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.qty_70kg && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <Info className="h-3 w-3 shrink-0" />
                {errors.qty_70kg.message}
              </p>
            )}
          </div>

          {/* 35 kg bags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">35 kg Bags</p>
                <p className="text-xs text-muted-foreground">77.16 lbs each</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <Controller
              name="qty_35kg"
              control={control}
              render={({ field }) => (
                <QtySpinner
                  value={Number(field.value) || 0}
                  onChange={(v) => field.onChange(v)}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>

          {/* 24 kg boxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">24 kg Boxes</p>
                <p className="text-xs text-muted-foreground">52.91 lbs each</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <Controller
              name="qty_24kg"
              control={control}
              render={({ field }) => (
                <QtySpinner
                  value={Number(field.value) || 0}
                  onChange={(v) => field.onChange(v)}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
        </div>

        {/* Live calculation display */}
        <div className={cn(
          'rounded-lg border p-4 transition-all',
          hasProducts
            ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
            : 'border-dashed border-muted-foreground/30 bg-muted/20'
        )}>
          <p className={cn(
            'text-xs font-semibold uppercase tracking-wider mb-3',
            hasProducts ? 'text-primary' : 'text-muted-foreground'
          )}>
            Calculated Shipment Specs
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                hasProducts ? 'bg-primary/10' : 'bg-muted'
              )}>
                <Layers className={cn('h-5 w-5', hasProducts ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {pallets}
                </p>
                <p className="text-xs text-muted-foreground">pallets</p>
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                hasProducts ? 'bg-primary/10' : 'bg-muted'
              )}>
                <Weight className={cn('h-5 w-5', hasProducts ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {weight.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">lbs</p>
              </div>
            </div>
          </div>
          {!hasProducts && (
            <p className="mt-2 text-xs text-muted-foreground">
              Enter quantities above to see calculated pallet and weight values
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── Section 6: Options ── */}
      <SectionCard icon={Truck} title="Service Options" description="Additional delivery requirements">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Liftgate Required</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select if the destination does not have a loading dock
            </p>
          </div>
          <Controller
            name="liftgate_required"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  field.value ? 'bg-primary' : 'bg-input'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  field.value ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            )}
          />
        </div>
      </SectionCard>

      {/* ── Submit ── */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              Submit Quote Request
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

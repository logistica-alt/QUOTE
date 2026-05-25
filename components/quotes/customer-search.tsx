'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Building2, MapPin, Loader2, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CustomerOption {
  id: string
  company_name: string
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string
  contact_name: string | null
  phone: string | null
  preferred_carrier: string | null
}

interface CustomerSearchProps {
  value: string
  onValueChange: (value: string) => void
  onCustomerSelect: (customer: CustomerOption | null) => void
  placeholder?: string
  error?: string
  disabled?: boolean
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  CA: '🇨🇦',
  EU: '🇪🇺',
  UK: '🇬🇧',
  AU: '🇦🇺',
}

const COUNTRY_LABELS: Record<string, string> = {
  US: 'USA',
  CA: 'Canada',
  EU: 'Europe',
  UK: 'UK',
  AU: 'Australia',
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function CustomerSearch({
  value,
  onValueChange,
  onCustomerSelect,
  placeholder = 'Search customer name...',
  error,
  disabled,
}: CustomerSearchProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CustomerOption[]>([])
  const [selected, setSelected] = useState<CustomerOption | null>(null)
  const [highlighted, setHighlighted] = useState(-1)

  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLUListElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)
  const debouncedValue = useDebounce(value, 280)

  // Fetch customers when debounced value changes
  useEffect(() => {
    if (debouncedValue.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    if (selected && selected.company_name === debouncedValue) {
      // Already selected — don't re-fetch
      return
    }

    setLoading(true)
    fetch(`/api/customers?search=${encodeURIComponent(debouncedValue)}&limit=8`)
      .then(r => r.json())
      .then(json => {
        setResults(json.data ?? [])
        setOpen((json.data ?? []).length > 0)
        setHighlighted(-1)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [debouncedValue, selected])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((customer: CustomerOption) => {
    setSelected(customer)
    onValueChange(customer.company_name)
    onCustomerSelect(customer)
    setOpen(false)
    setResults([])
  }, [onValueChange, onCustomerSelect])

  const handleClear = useCallback(() => {
    setSelected(null)
    onValueChange('')
    onCustomerSelect(null)
    setOpen(false)
    setResults([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [onValueChange, onCustomerSelect])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  const isSelected = selected !== null

  return (
    <div ref={wrapRef} className="relative">
      {/* Input */}
      <div
        className={cn(
          'relative flex items-center',
          'rounded-lg border bg-background transition-shadow',
          open
            ? 'border-primary ring-2 ring-primary/20'
            : error
            ? 'border-destructive'
            : 'border-input hover:border-primary/50',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        {/* Left icon */}
        <div className="pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : isSelected ? (
            <Building2 className="h-4 w-4 text-primary" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => {
            onValueChange(e.target.value)
            if (selected) {
              setSelected(null)
              onCustomerSelect(null)
            }
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed'
          )}
        />

        {/* Right: clear button or dropdown arrow */}
        <div className="pr-2 flex items-center gap-1">
          {isSelected && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </div>
      </div>

      {/* Selected customer preview */}
      {isSelected && selected && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <span>{COUNTRY_FLAGS[selected.country] ?? '🌐'}</span>
                <span>{selected.company_name}</span>
                {selected.country !== 'US' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {COUNTRY_LABELS[selected.country] ?? selected.country} — Manual only
                  </span>
                )}
              </div>
              {(selected.street || selected.city) && (
                <div className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span>
                    {[selected.street, selected.city, selected.state, selected.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
              {selected.contact_name && (
                <div className="text-muted-foreground text-xs">
                  Contact: {selected.contact_name}
                  {selected.phone && ` · ${selected.phone}`}
                </div>
              )}
              {selected.preferred_carrier && (
                <div className="text-xs text-primary font-medium">
                  Preferred carrier: {selected.preferred_carrier}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {results.map((customer, idx) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2.5 transition-colors',
                    'hover:bg-accent',
                    highlighted === idx && 'bg-accent'
                  )}
                  onMouseEnter={() => setHighlighted(idx)}
                  onMouseDown={e => {
                    e.preventDefault()
                    handleSelect(customer)
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <span className="flex-shrink-0">{COUNTRY_FLAGS[customer.country] ?? '🌐'}</span>
                        <span className="truncate">{customer.company_name}</span>
                      </div>
                      {(customer.city || customer.state) && (
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {[customer.city, customer.state, customer.zip]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    {customer.country !== 'US' && (
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {COUNTRY_LABELS[customer.country] ?? customer.country}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="px-3 py-2 border-t border-border bg-muted/40">
            <p className="text-xs text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''} · Type to narrow · ↑↓ navigate · Enter select
            </p>
          </div>
        </div>
      )}

      {/* No results hint */}
      {open && results.length === 0 && !loading && value.length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl">
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No customer found for <span className="font-medium text-foreground">"{value}"</span>
            <p className="mt-1 text-xs">You can still type the name manually below.</p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

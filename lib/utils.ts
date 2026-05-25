import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatWeight(pounds: number | null | undefined): string {
  if (pounds == null) return '—'
  return `${pounds.toLocaleString('en-US', { maximumFractionDigits: 2 })} lbs`
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'MM/dd/yyyy')
  } catch {
    return '—'
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatPallets(count: number | null | undefined): string {
  if (count == null) return '—'
  return `${count} ${count === 1 ? 'pallet' : 'pallets'}`
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function isCanadianZip(zip: string): boolean {
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(zip)
}

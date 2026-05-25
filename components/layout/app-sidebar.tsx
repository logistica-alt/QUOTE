'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Leaf,
  LogOut,
  ChevronRight,
  RefreshCw,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface AppSidebarProps {
  user: { email: string; id: string }
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'New Quote',
    href: '/quotes/new',
    icon: PlusCircle,
  },
  {
    label: 'Quote History',
    href: '/quotes',
    icon: History,
  },
]

function getInitials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleSyncCustomers() {
    setSyncing(true)
    try {
      const res = await fetch('/api/customers/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      toast.success(`Customers synced`, {
        description: `${json.synced} records updated from Google Sheets`,
      })
    } catch (err) {
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Check console for details',
      })
    } finally {
      setSyncing(false)
    }
  }

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/quotes/new') return pathname === '/quotes/new'
    if (href === '/quotes') return pathname === '/quotes' || (pathname.startsWith('/quotes/') && pathname !== '/quotes/new')
    return pathname === href
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Leaf className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-sidebar-foreground leading-tight">
            Forest Coffee
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            Logistics
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
                )}
              />
              {label}
              {active && (
                <ChevronRight className="ml-auto h-3 w-3 text-primary-foreground/70" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom User Section */}
      <div className="border-t border-sidebar-border p-3 space-y-1">

        {/* Sync Customers button */}
        <button
          onClick={handleSyncCustomers}
          disabled={syncing}
          title="Pull latest customer data from Google Sheets"
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
            'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
            syncing && 'opacity-60 cursor-not-allowed'
          )}
        >
          {syncing
            ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
            : <Users className="h-4 w-4 shrink-0" />
          }
          {syncing ? 'Syncing…' : 'Sync Customers'}
        </button>

        {/* User row */}
        <div className="flex items-center gap-3 rounded-md px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="text-xs font-semibold">{getInitials(user.email)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground">Logged in</p>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
            'text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

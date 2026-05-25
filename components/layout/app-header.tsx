'use client'

import { usePathname } from 'next/navigation'
import { Menu, ChevronDown, LogOut, User } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { ThemeToggle } from './theme-toggle'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AppHeaderProps {
  user: { email: string }
  onMenuToggle?: () => void
}

function getInitials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname === '/quotes/new') return 'New Quote'
  if (pathname === '/quotes') return 'Quote History'
  if (pathname.startsWith('/quotes/')) return 'Quote Details'
  return 'Forest Coffee Logistics'
}

export function AppHeader({ user, onMenuToggle }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const pageTitle = getPageTitle(pathname)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    setDropdownOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className={cn(
          'flex lg:hidden items-center justify-center h-9 w-9 rounded-md',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label="Toggle navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page Title */}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground">
          {pageTitle}
        </h1>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* User Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5',
              'hover:bg-accent hover:text-accent-foreground transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-xs font-semibold">{getInitials(user.email)}</span>
            </div>
            <span className="hidden sm:block max-w-[160px] truncate text-sm font-medium text-foreground">
              {user.email}
            </span>
            <ChevronDown className={cn(
              'hidden sm:block h-3.5 w-3.5 text-muted-foreground transition-transform',
              dropdownOpen && 'rotate-180'
            )} />
          </button>

          {dropdownOpen && (
            <div className={cn(
              'absolute right-0 mt-2 w-56 z-50',
              'rounded-md border border-border bg-popover shadow-md',
              'animate-in fade-in-0 zoom-in-95'
            )}>
              <div className="p-2">
                <div className="flex items-center gap-2 px-2 py-2 border-b border-border mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="text-xs font-semibold">{getInitials(user.email)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Logged in</p>
                  </div>
                </div>
                <button
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
                  )}
                  onClick={() => setDropdownOpen(false)}
                >
                  <User className="h-3.5 w-3.5" />
                  Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'text-destructive hover:bg-destructive/10 transition-colors'
                  )}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

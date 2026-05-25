'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const currentIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-center h-9 w-9 rounded-md',
          'border border-input bg-background',
          'hover:bg-accent hover:text-accent-foreground',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4" />
        ) : theme === 'light' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Monitor className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 mt-2 w-36 z-50',
          'rounded-md border border-border bg-popover shadow-md',
          'animate-in fade-in-0 zoom-in-95'
        )}>
          <div className="p-1">
            {options.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  'hover:bg-accent hover:text-accent-foreground transition-colors',
                  theme === value && 'bg-accent text-accent-foreground font-medium'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {theme === value && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

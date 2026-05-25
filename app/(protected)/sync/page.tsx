'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SyncPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<{ synced?: number; total?: number; errors?: number; error?: string } | null>(null)

  async function handleSync() {
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/customers/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setResult(data)
      setStatus('success')
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Unknown error' })
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-600" />

          <div className="p-8 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
              <Users className="h-8 w-8 text-primary" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-foreground">Sync Customers</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Import latest customer data from Google Sheets
              </p>
            </div>

            {/* Idle / Loading */}
            {(status === 'idle' || status === 'loading') && (
              <button
                onClick={handleSync}
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-xl py-3.5 px-6 font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw className={`h-5 w-5 ${status === 'loading' ? 'animate-spin' : ''}`} />
                {status === 'loading' ? 'Syncing customers...' : 'Sync Now'}
              </button>
            )}

            {/* Success */}
            {status === 'success' && result && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="font-semibold">Sync Complete!</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customers synced</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">{result.synced}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total in sheet</span>
                    <span className="font-semibold">{result.total}</span>
                  </div>
                  {result.errors && result.errors > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Errors</span>
                      <span className="text-destructive">{result.errors}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSync}
                    className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" /> Sync Again
                  </button>
                  <Link
                    href="/quotes/new"
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    New Quote →
                  </Link>
                </div>
              </div>
            )}

            {/* Error */}
            {status === 'error' && result && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <XCircle className="h-6 w-6" />
                  <span className="font-semibold">Sync Failed</span>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
                  {result.error}
                </div>
                <button
                  onClick={handleSync}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Sheet: BASE DE DATOS · {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

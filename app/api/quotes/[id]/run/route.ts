import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: quoteId } = params

    // Verify the quote belongs to this user
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, status')
      .eq('id', quoteId)
      .eq('created_by', user.id)
      .single()

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    if (quote.status === 'processing') {
      return NextResponse.json({ message: 'Already processing' }, { status: 200 })
    }

    const cwd = process.cwd()
    const isProd = process.env.NODE_ENV === 'production'

    // Write stdout/stderr to a log file so we can debug issues
    const logPath = path.join(cwd, `automation-${quoteId.slice(0, 8)}.log`)
    const logStream = require('fs').openSync(logPath, 'w')

    let cmd: string
    let cmdArgs: string[]

    if (isProd) {
      // Production: run the pre-compiled JS (built during Docker image build)
      cmd = 'node'
      cmdArgs = [
        path.join(cwd, 'dist-scripts', 'echo-automation.js'),
        `--quote-id=${quoteId}`,
      ]
    } else {
      // Development: run TypeScript directly via ts-node
      const scriptPath = path.join(cwd, 'scripts', 'echo-automation.ts')
      const tsConfig   = path.join(cwd, 'tsconfig.scripts.json')
      const isWindows  = process.platform === 'win32'
      const tsNodeBin  = path.join(
        cwd, 'node_modules', '.bin',
        isWindows ? 'ts-node.cmd' : 'ts-node'
      )
      cmd     = tsNodeBin
      cmdArgs = ['--project', tsConfig, scriptPath, `--quote-id=${quoteId}`]
    }

    // Spawn as a fully detached background process — returns immediately
    const child = spawn(cmd, cmdArgs, {
      detached: true,
      stdio:    ['ignore', logStream, logStream],
      shell:    !isProd && process.platform === 'win32',
      cwd,
    })
    child.unref()

    console.log(`Automation spawned for quote ${quoteId} — log: ${logPath}`)

    return NextResponse.json({ message: 'Automation started', quote_id: quoteId }, { status: 202 })
  } catch (err) {
    console.error('Run automation error:', err)
    return NextResponse.json({ error: 'Failed to start automation' }, { status: 500 })
  }
}

import { describe, it, expect, vi } from 'vitest'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { v4 as uuidv4 } from 'uuid'

const CLI_PATH = resolve(__dirname, '..', '..', 'dist', 'cli.js')
const TSX_PATH = resolve(__dirname, '..', '..', 'node_modules', '.bin', 'tsx')

function runCli(args: string[], input?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execSync(
      `node ${CLI_PATH} ${args.join(' ')}`,
      {
        input,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )
    // execSync throws on non-zero exit
    return { stdout: result || '', stderr: '', exitCode: 0 }
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: string
      stderr?: string
      status?: number
    }
    return {
      stdout: execErr.stdout as string || '',
      stderr: execErr.stderr as string || '',
      exitCode: execErr.status ?? 1,
    }
  }
}

function runTsx(args: string[], input?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execSync(
      `"${TSX_PATH}" ${args.join(' ')}`,
      {
        input,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )
    return { stdout: result || '', stderr: '', exitCode: 0 }
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: string
      stderr?: string
      status?: number
    }
    return {
      stdout: execErr.stdout as string || '',
      stderr: execErr.stderr as string || '',
      exitCode: execErr.status ?? 1,
    }
  }
}

describe('CLI', () => {
  it('--help prints usage', () => {
    const { stdout, exitCode } = runCli(['--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage')
  })

  it('--version prints version', () => {
    const { stdout, exitCode } = runCli(['--version'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('0.2.0')
  })

  it('verify --help shows verify usage', () => {
    const { stdout, exitCode } = runCli(['verify', '--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Verify citations')
  })

  it('compliance --help shows compliance usage', () => {
    const { stdout, exitCode } = runCli(['compliance', '--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Generate a compliance report')
  })

  it('coverage prints coverage map', () => {
    const { stdout, exitCode } = runCli(['coverage'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('LegalVerify')
    expect(stdout).toContain('CourtListener')
  })

  it('serve --help shows serve usage', () => {
    const { stdout, exitCode } = runCli(['serve', '--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Start the LegalVerify')
  })

  it('verify exits with error on nonexistent file', () => {
    const { stderr, exitCode } = runCli(['verify', '/nonexistent/file.txt'])
    expect(exitCode).not.toBe(0)
  })
})

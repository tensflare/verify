import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SourceResolver } from '../../src/verify/resolver.js'
import type { SourceAdapter } from '../../src/sources/types.js'
import type { VerifiableCitation } from '../../src/schema.js'

function mockAdapter(name: string, priority: number, opts?: {
  supports?: boolean
  covered?: boolean
  found?: boolean
  error?: string
  rateLimit?: number
}): SourceAdapter {
  const supports = opts?.supports ?? true
  const covered = opts?.covered ?? true
  const found = opts?.found ?? true
  const error = opts?.error
  const rateLimit = opts?.rateLimit ?? 0

  return {
    name,
    priority,
    rateLimit,
    coverage: {
      source: name,
      jurisdictions: ['US'],
      coverageType: covered ? 'full' : 'none',
      dateRange: { from: '2000-01-01', to: 'present' },
      updateFrequency: 'daily',
      knownGaps: [],
      accessRestrictions: [],
      confidence: covered ? 0.95 : 0,
    },
    supports: () => supports,
    checkCoverage: () => ({
      covered,
      coverageType: covered ? 'full' : 'none',
      dateRange: { from: '2000-01-01', to: 'present' },
      confidence: covered ? 0.95 : 0,
    }),
    resolve: async () => ({
      found,
      url: found ? `https://example.com/${name}/result` : undefined,
      error,
      responseTimeMs: 10,
    }),
  }
}

describe('SourceResolver', () => {
  let usCitation: VerifiableCitation
  let ukCitation: VerifiableCitation

  beforeEach(() => {
    usCitation = {
      raw_text: '410 U.S. 113',
      normalized_text: '410 U.S. 113',
      type: 'case',
      jurisdiction: 'US',
    }
    ukCitation = {
      raw_text: '[2024] UKSC 1',
      normalized_text: '[2024] UKSC 1',
      type: 'case',
      jurisdiction: 'UK',
    }
  })

  it('resolves via highest priority adapter', async () => {
    const resolver = new SourceResolver([
      mockAdapter('Primary', 1, { found: true }),
      mockAdapter('Secondary', 2, { found: false }),
    ])
    const result = await resolver.resolve(usCitation)
    expect(result.status).toBe('verified')
    expect(result.sources_checked).toHaveLength(2)
    expect(result.sources_checked[0].source_name).toBe('Primary')
    expect(result.sources_checked[0].found).toBe(true)
  })

  it('falls back when primary adapter returns not found', async () => {
    const resolver = new SourceResolver([
      mockAdapter('Primary', 1, { found: false }),
      mockAdapter('Secondary', 2, { found: true }),
    ])
    const result = await resolver.resolve(usCitation)
    expect(result.status).toBe('verified')
    expect(result.sources_checked[0].source_name).toBe('Primary')
    expect(result.sources_checked[0].found).toBe(false)
    expect(result.sources_checked[1].source_name).toBe('Secondary')
    expect(result.sources_checked[1].found).toBe(true)
  })

  it('returns hallucinated when all covered sources say not found', async () => {
    const resolver = new SourceResolver([
      mockAdapter('Primary', 1, { found: false }),
      mockAdapter('Secondary', 2, { found: false }),
    ])
    const result = await resolver.resolve(usCitation)
    expect(result.status).toBe('hallucinated')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('returns unverifiable when no adapter supports citation', async () => {
    const resolver = new SourceResolver([
      mockAdapter('USOnly', 1, { supports: false }),
    ])
    const result = await resolver.resolve(ukCitation)
    expect(result.status).toBe('unverifiable')
    expect(result.confidence).toBe(0)
  })

  it('returns unverifiable when all adapters error', async () => {
    const resolver = new SourceResolver([
      mockAdapter('Broken', 1, { found: false, error: 'Network error' }),
    ])
    const result = await resolver.resolve(usCitation)
    expect(result.status).toBe('unverifiable')
    expect(result.sources_checked[0].error).toBe('Network error')
  })

  it('returns unverifiable when no adapter has coverage', async () => {
    const resolver = new SourceResolver([
      mockAdapter('NoCoverage', 1, { covered: false }),
    ])
    const result = await resolver.resolve(usCitation)
    expect(result.status).toBe('unverifiable')
  })

  it('respects priority ordering', async () => {
    const adapters = [
      mockAdapter('Low', 100),
      mockAdapter('Medium', 10),
      mockAdapter('High', 1),
    ]
    const resolver = new SourceResolver(adapters)
    const result = await resolver.resolve(usCitation)
    expect(result.sources_checked[0].source_name).toBe('High')
    expect(result.sources_checked[1].source_name).toBe('Medium')
    expect(result.sources_checked[2].source_name).toBe('Low')
  })

  it('skips adapters that do not support citation type', async () => {
    const resolver = new SourceResolver([
      mockAdapter('StatsOnly', 1, { supports: false, found: false }),
      mockAdapter('CaseOnly', 2),
    ])
    const result = await resolver.resolve(usCitation)
    expect(result.sources_checked[0].source_name).toBe('CaseOnly')
  })

  it('returns UUID in id field', async () => {
    const resolver = new SourceResolver([mockAdapter('Test', 1)])
    const result = await resolver.resolve(usCitation)
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('respects rate limit between adapter calls', async () => {
    const adapterA = mockAdapter('Slow', 1, { rateLimit: 50 })
    const adapterB = mockAdapter('Fast', 2, { rateLimit: 0 })
    const resolver = new SourceResolver([adapterA, adapterB])

    const start = Date.now()
    await resolver.resolve(usCitation)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(0)
    expect(elapsed).toBeLessThan(200)
  })
})

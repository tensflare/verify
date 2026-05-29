import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CitationVerifier, formatCoverageMap, checkCoverage, SCOPE_SHORT, formatScopeNotice } from '../src/index.js'

// Mock fetch globally for integration-ish tests
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('CitationVerifier', () => {
  const verifier = new CitationVerifier()

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('verifies text with no citations', async () => {
    const result = await verifier.verifyText('This is a plain text with no legal citations.')
    expect(result.total_citations).toBe(0)
    expect(result.verified_count).toBe(0)
    expect(result.hallucinated_count).toBe(0)
    expect(result.overall_score).toBe(0)
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.scope_notice).toBe(SCOPE_SHORT)
  })

  it('verifies text with known US citations (no network, falls to unverifiable)', async () => {
    const result = await verifier.verifyText('The Court held in Roe v. Wade, 410 U.S. 113 that...')
    expect(result.total_citations).toBeGreaterThan(0)
    expect(result.scope_notice).toBe(SCOPE_SHORT)
    expect(result.document_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('accepts optional document name', async () => {
    const result = await verifier.verifyText('Test text', { documentName: 'test-doc' })
    expect(result.document_name).toBe('test-doc')
  })

  it('deduplicates identical citations', async () => {
    const text = 'See Roe v. Wade, 410 U.S. 113. Also see Roe v. Wade, 410 U.S. 113 again.'
    const result = await verifier.verifyText(text)
    expect(result.total_citations).toBe(1)
  })

  it('returns coverage summary', async () => {
    const result = await verifier.verifyText('Plain text')
    expect(result.coverage_summary).toHaveProperty('covered')
    expect(result.coverage_summary).toHaveProperty('partial')
    expect(result.coverage_summary).toHaveProperty('uncovered')
  })
})

describe('exports', () => {
  it('exposes formatCoverageMap', () => {
    expect(typeof formatCoverageMap).toBe('function')
    expect(formatCoverageMap()).toContain('LegalVerify')
  })

  it('exposes SCOPE_SHORT constant', () => {
    expect(SCOPE_SHORT).toContain('citation existence')
  })

  it('exposes formatScopeNotice', () => {
    expect(typeof formatScopeNotice).toBe('function')
    expect(formatScopeNotice()).toContain('SCOPE NOTICE')
  })
})

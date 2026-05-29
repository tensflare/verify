import { describe, it, expect } from 'vitest'
import { generateComplianceReport, getRuleSet, listRuleSets } from '../../src/compliance/rules.js'
import type { DocumentVerification, CitationVerification } from '../../src/schema.js'
import { v4 as uuidv4 } from 'uuid'

function mockCV(status: CitationVerification['status'] = 'verified'): CitationVerification {
  return {
    id: uuidv4(),
    citation: { raw_text: '410 U.S. 113', normalized_text: '410 U.S. 113', type: 'case', jurisdiction: 'US' },
    status,
    confidence: status === 'verified' ? 0.95 : 0,
    sources_checked: [{ source_name: 'Test', coverage: { covered: true, coverageType: 'full', dateRange: { from: '2000-01-01', to: 'present' }, confidence: 0.95 }, found: status === 'verified', response_time_ms: 10 }],
    checked_at: new Date().toISOString(),
  }
}

function makeDoc(overrides?: Partial<DocumentVerification>): DocumentVerification {
  const citations = Array.from({ length: 5 }, () => mockCV('verified'))
  return {
    id: uuidv4(),
    document_name: 'test',
    document_hash: 'hash',
    total_citations: 5,
    verified_count: 5,
    hallucinated_count: 0,
    misattributed_count: 0,
    unverifiable_count: 0,
    pending_count: 0,
    overall_score: 1.0,
    coverage_summary: { covered: 5, partial: 0, uncovered: 0 },
    citations,
    checked_at: new Date().toISOString(),
    duration_ms: 100,
    scope_notice: 'scope',
    ...overrides,
  }
}

describe('generateComplianceReport', () => {
  it('passes with all citations verified', async () => {
    const doc = makeDoc()
    const report = await generateComplianceReport(doc)
    expect(report.passed).toBe(true)
    expect(report.standard).toBe('ny-part-161')
    expect(report.summary).toContain('PASS')
  })

  it('fails when hallucinated citations exist', async () => {
    const doc = makeDoc({ verified_count: 3, hallucinated_count: 2, total_citations: 5, overall_score: 0.6 })
    const report = await generateComplianceReport(doc)
    expect(report.passed).toBe(false)
    expect(report.summary).toContain('FAIL')
    expect(report.summary).toContain('2')
  })

  it('fails on misattributed citations', async () => {
    const doc = makeDoc({ verified_count: 4, hallucinated_count: 0, misattributed_count: 1, total_citations: 5, overall_score: 0.8 })
    const report = await generateComplianceReport(doc)
    expect(report.passed).toBe(false)
  })

  it('reports all findings', async () => {
    const doc = makeDoc()
    const report = await generateComplianceReport(doc)
    expect(report.findings.length).toBeGreaterThanOrEqual(4)
    expect(report.findings.every(f => f.met)).toBe(true)
  })

  it('includes scope notice', async () => {
    const doc = makeDoc()
    const report = await generateComplianceReport(doc)
    expect(report.scope_notice).toBeTruthy()
    expect(report.scope_notice).toContain('citation existence')
  })

  it('has expiration of 24h by default', async () => {
    const doc = makeDoc()
    const report = await generateComplianceReport(doc)
    const expires = new Date(report.expires_at)
    const generated = new Date(report.generated_at)
    const diffMs = expires.getTime() - generated.getTime()
    expect(diffMs).toBeGreaterThan(86000000)
    expect(diffMs).toBeLessThan(90000000)
  })

  it('accepts generic standard', async () => {
    const doc = makeDoc()
    const report = await generateComplianceReport(doc, { standard: 'generic' })
    expect(report.standard).toBe('generic')
    expect(report.passed).toBe(true)
  })

  it('accepts custom jurisdiction', async () => {
    const doc = makeDoc()
    const report = await generateComplianceReport(doc, { jurisdiction: 'US-CA' })
    expect(report.jurisdiction).toBe('US-CA')
  })
})

describe('getRuleSet', () => {
  it('returns NY Part 161 ruleset', () => {
    const rs = getRuleSet('ny-part-161')
    expect(rs.id).toBe('ny-part-161')
    expect(rs.jurisdiction).toBe('US-NY')
    expect(rs.rules.length).toBeGreaterThanOrEqual(4)
  })

  it('falls back to generic for unknown standard', () => {
    const rs = getRuleSet('unknown-standard')
    expect(rs.id).toBe('generic')
    expect(rs.jurisdiction).toBe('*')
  })
})

describe('listRuleSets', () => {
  it('returns available rulesets', () => {
    const sets = listRuleSets()
    expect(sets.length).toBeGreaterThanOrEqual(2)
    const nyPart161 = sets.find(s => s.id === 'ny-part-161')
    expect(nyPart161).toBeDefined()
    expect(nyPart161!.jurisdiction).toBe('US-NY')
  })
})

import { describe, it, expect } from 'vitest'
import { checkCoverage, COVERAGE_DECLARATIONS, formatCoverageMap } from '../../src/verify/coverage.js'
import type { VerifiableCitation } from '../../src/schema.js'

describe('checkCoverage', () => {
  const usCase: VerifiableCitation = {
    raw_text: '410 U.S. 113',
    normalized_text: '410 U.S. 113',
    type: 'case',
    jurisdiction: 'US',
  }

  const ukCase: VerifiableCitation = {
    raw_text: '[2024] UKSC 1',
    normalized_text: '[2024] UKSC 1',
    type: 'case',
    jurisdiction: 'UK',
  }

  const auCase: VerifiableCitation = {
    raw_text: '(2023) 97 CLR 456',
    normalized_text: '(2023) 97 CLR 456',
    type: 'case',
    jurisdiction: 'AU',
  }

  const usStatute: VerifiableCitation = {
    raw_text: '15 U.S.C. § 1',
    normalized_text: '15 U.S.C. § 1',
    type: 'statute',
    jurisdiction: 'US',
  }

  const euCase: VerifiableCitation = {
    raw_text: 'ECLI:EU:C:2024:123',
    normalized_text: 'ECLI:EU:C:2024:123',
    type: 'case',
    jurisdiction: 'EU',
  }

  it('covers US case law', () => {
    const result = checkCoverage(usCase)
    expect(result.coveredSources.length).toBeGreaterThan(0)
    expect(result.bestCoverage.covered).toBe(true)
  })

  it('covers US statutes', () => {
    const result = checkCoverage(usStatute)
    expect(result.coveredSources.length).toBeGreaterThan(0)
    expect(result.bestCoverage.covered).toBe(true)
  })

  it('covers AU cases via Google Scholar', () => {
    const result = checkCoverage(auCase)
    expect(result.coveredSources.length).toBeGreaterThan(0)
  })

  it('does not cover EU citations', () => {
    const result = checkCoverage(euCase)
    expect(result.coveredSources.length).toBe(0)
    expect(result.bestCoverage.covered).toBe(false)
    expect(result.bestCoverage.gapNote).toBeTruthy()
  })

  it('covers UK citations via Google Scholar', () => {
    const result = checkCoverage(ukCase)
    expect(result.coveredSources.length).toBe(1)
    expect(result.coveredSources[0].source).toBe('Google Scholar')
    expect(result.bestCoverage.covered).toBe(true)
    expect(result.bestCoverage.confidence).toBe(0.7)
  })

  it('handles citations without jurisdiction (defaults to US)', () => {
    const noJur: VerifiableCitation = {
      raw_text: '410 U.S. 113',
      normalized_text: '410 U.S. 113',
      type: 'case',
    }
    const result = checkCoverage(noJur)
    expect(result.coveredSources.length).toBeGreaterThan(0)
    expect(result.bestCoverage.covered).toBe(true)
  })

  it('handles state-level jurisdictions', () => {
    const caCase: VerifiableCitation = {
      raw_text: '123 Cal. Rptr. 456',
      normalized_text: '123 Cal. Rptr. 456',
      type: 'case',
      jurisdiction: 'US-CA',
    }
    const result = checkCoverage(caCase)
    expect(result.coveredSources.length).toBeGreaterThan(0)
  })

  it('does not cover non-case, non-statute types', () => {
    const treatise: VerifiableCitation = {
      raw_text: 'Prosser on Torts § 1',
      normalized_text: 'Prosser on Torts § 1',
      type: 'treatise',
      jurisdiction: 'US',
    }
    const result = checkCoverage(treatise)
    expect(result.coveredSources.length).toBe(0)
    expect(result.bestCoverage.covered).toBe(false)
  })

  it('picks highest confidence source', () => {
    const result = checkCoverage(usCase)
    expect(result.bestCoverage.confidence).toBeGreaterThanOrEqual(0.95)
  })
})

describe('COVERAGE_DECLARATIONS', () => {
  it('has 2 sources declared', () => {
    expect(COVERAGE_DECLARATIONS).toHaveLength(2)
  })

  it('each source has required fields', () => {
    for (const dec of COVERAGE_DECLARATIONS) {
      expect(dec.source).toBeTruthy()
      expect(dec.jurisdictions.length).toBeGreaterThan(0)
      expect(dec.coverageType).toMatch(/^full|partial|limited$/)
      expect(dec.dateRange.from).toBeTruthy()
      expect(dec.dateRange.to).toBeTruthy()
      expect(dec.confidence).toBeGreaterThan(0)
    }
  })
})

describe('formatCoverageMap', () => {
  it('returns a non-empty coverage map string', () => {
    const map = formatCoverageMap()
    expect(map).toBeTruthy()
    expect(map).toContain('LegalVerify')
    expect(map).toContain('2 source(s) configured')
  })
})

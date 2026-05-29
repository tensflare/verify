import { describe, it, expect } from 'vitest'
import { extractCitations, hasCitationPatterns } from '../../src/verify/parser.js'
import { CitationVerifier } from '../../src/index.js'
import * as Samples from './samples.js'

describe('Fixture: US Federal Sample', () => {
  it('extracts multiple citations', () => {
    const results = extractCitations(Samples.US_FEDERAL_SAMPLE)
    expect(results.length).toBeGreaterThanOrEqual(6)
  })

  it('contains Roe v. Wade citation', () => {
    const results = extractCitations(Samples.US_FEDERAL_SAMPLE)
    const texts = results.map(r => r.citation.raw_text)
    expect(texts.some(t => t.includes('410 U.S. 113'))).toBe(true)
  })

  it('contains Fed. R. Civ. P. citation', () => {
    const results = extractCitations(Samples.US_FEDERAL_SAMPLE)
    const texts = results.map(r => r.citation.raw_text)
    expect(texts.some(t => t.startsWith('Fed. R. Civ. P. 12'))).toBe(true)
  })

  it('contains US Code citation', () => {
    const results = extractCitations(Samples.US_FEDERAL_SAMPLE)
    const texts = results.map(r => r.citation.raw_text)
    expect(texts.some(t => t.includes('15 U.S.C. § 1'))).toBe(true)
  })

  it('hasCitationPatterns returns true', () => {
    expect(hasCitationPatterns(Samples.US_FEDERAL_SAMPLE)).toBe(true)
  })
})

describe('Fixture: UK Sample', () => {
  it('extracts UK citations', () => {
    const results = extractCitations(Samples.UK_SAMPLE)
    const types = results.map(r => r.citation.type)
    expect(types.some(t => t === 'case')).toBe(true)
  })

  it('contains UKSC citation', () => {
    const results = extractCitations(Samples.UK_SAMPLE)
    const texts = results.map(r => r.citation.raw_text)
    expect(texts.some(t => t.includes('UKSC'))).toBe(true)
  })
})

describe('Fixture: EU Sample', () => {
  it('extracts EU citations', () => {
    const results = extractCitations(Samples.EU_SAMPLE)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Fixture: AU Sample', () => {
  it('extracts AU citations', () => {
    const results = extractCitations(Samples.AU_SAMPLE)
    expect(results.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Fixture: CA Sample', () => {
  it('extracts Canadian citations', () => {
    const results = extractCitations(Samples.CA_SAMPLE)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Fixture: Mixed Jurisdiction', () => {
  it('extracts citations from multiple jurisdictions', () => {
    const results = extractCitations(Samples.MIXED_JURISDICTION_SAMPLE)
    const jurs = new Set(results.map(r => r.citation.jurisdiction))
    expect(jurs.has('US')).toBe(true)
  })
})

describe('Fixture: No Citations', () => {
  it('returns zero citations', () => {
    const results = extractCitations(Samples.NO_CITATIONS_SAMPLE)
    expect(results.length).toBe(0)
  })

  it('hasCitationPatterns returns false', () => {
    expect(hasCitationPatterns(Samples.NO_CITATIONS_SAMPLE)).toBe(false)
  })
})

describe('Fixture: Duplicate Citations', () => {
  it('deduplicates identical citations via CitationVerifier', { timeout: 15000 }, async () => {
    const verifier = new CitationVerifier()
    const result = await verifier.verifyText(Samples.DUPLICATE_CITATIONS_SAMPLE)
    expect(result.total_citations).toBe(1)
  })
})

describe('Fixture: Malformed Citations', () => {
  it('does not extract malformed citations', () => {
    const results = extractCitations(Samples.MALFORMED_CITATIONS_SAMPLE)
    // Should have very few or zero valid extractions
    expect(results.length).toBeLessThan(3)
  })
})

describe('Fixture: Unicode', () => {
  it('extracts citations from text with unicode', () => {
    const results = extractCitations(Samples.UNICODE_SAMPLE)
    expect(results.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Fixture: Long Text', () => {
  it('handles long text', { timeout: 30000 }, async () => {
    const verifier = new CitationVerifier()
    const result = await verifier.verifyText(Samples.LONG_TEXT_SAMPLE)
    expect(result.total_citations).toBeGreaterThanOrEqual(1)
    expect(result.duration_ms).toBeGreaterThan(0)
  })
})

describe('Fixture: Varying Confidence', () => {
  it('processes diverse citation types', () => {
    const results = extractCitations(Samples.VARYING_CONFIDENCE_SAMPLE)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})

import { describe, it, expect } from 'vitest'
import { extractCitations, hasCitationPatterns, normalizeCitation, getSupportedFormats } from '../../src/verify/parser.js'
import { CitationVerifier } from '../../src/index.js'

describe('Edge Cases', () => {
  it('handles empty text', async () => {
    const verifier = new CitationVerifier()
    const result = await verifier.verifyText('')
    expect(result.total_citations).toBe(0)
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('handles whitespace-only text', async () => {
    const verifier = new CitationVerifier()
    const result = await verifier.verifyText('   \n\n  \t  ')
    expect(result.total_citations).toBe(0)
  })

  it('handles null bytes in text', () => {
    const results = extractCitations('before\x00after')
    expect(Array.isArray(results)).toBe(true)
  })

  it('handles very short text', async () => {
    const verifier = new CitationVerifier()
    const result = await verifier.verifyText('Hi')
    expect(result.total_citations).toBe(0)
    expect(result.document_name).toBe('inline')
  })

  it('handles text with only numbers', async () => {
    const verifier = new CitationVerifier()
    const result = await verifier.verifyText('12345 67890 111213')
    expect(result.total_citations).toBe(0)
  })

  it('handles text with special characters', () => {
    const text = '!@#$%^&*()_+-=[]{}|;:<>,.?/~`'
    const results = extractCitations(text)
    expect(results.length).toBe(0)
  })

  it('handles emoji-only text', () => {
    const text = '🌟🚀🎉💯🔥'
    const results = extractCitations(text)
    expect(results.length).toBe(0)
  })

  it('handles mixed CJK and citations', () => {
    const text = '根据Roe v. Wade, 410 U.S. 113 (1973)一案'
    const results = extractCitations(text)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some(r => r.citation.raw_text.includes('410 U.S. 113'))).toBe(true)
  })

  it('handles citation at start of text', () => {
    const text = '410 U.S. 113 is a landmark case.'
    const results = extractCitations(text)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('handles citation at end of text', () => {
    const text = 'The court relied on 410 U.S. 113'
    const results = extractCitations(text)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('handles multiple citations on one line', () => {
    const text = 'See 410 U.S. 113, 384 U.S. 436, and 505 U.S. 833'
    const results = extractCitations(text)
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('handles parenthetical citations', () => {
    const text = 'The standard was established in Miranda (384 U.S. 436, 1966).'
    const results = extractCitations(text)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('handles HTML entities in text', () => {
    const text = 'See 410 U.S. 113 &amp; 384 U.S. 436'
    const results = extractCitations(text)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('does not extract non-legal number patterns', () => {
    const text = 'The temperature was 98.6 degrees. The year was 2024. Section 5 of the report.'
    const results = extractCitations(text)
    // These should not match any legal citation patterns
    const standardCitations = results.filter(r => r.citation.type === 'case' || r.citation.type === 'statute')
    expect(standardCitations.length).toBe(0)
  })

  it('handles text with tabs between citation parts', () => {
    const text = '410\tU.S.\t113'
    const results = extractCitations(text)
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  it('normalizeCitation handles various input', () => {
    expect(normalizeCitation('  410 U.S. 113  ')).toBe('410 U.S. 113')
    expect(normalizeCitation('410 U.S. 113,')).toBe('410 U.S. 113')
    expect(normalizeCitation('410 U.S. 113.')).toBe('410 U.S. 113')
    expect(normalizeCitation('*410 U.S. 113*')).toBe('410 U.S. 113')
    expect(normalizeCitation('')).toBe('')
  })

  it('hasCitationPatterns works correctly', () => {
    expect(hasCitationPatterns('410 U.S. 113')).toBe(true)
    expect(hasCitationPatterns('[2024] UKSC 1')).toBe(true)
    expect(hasCitationPatterns('hello world')).toBe(false)
    expect(hasCitationPatterns('')).toBe(false)
  })

  it('getSupportedFormats returns list of patterns', () => {
    const formats = getSupportedFormats()
    expect(formats.length).toBeGreaterThan(10)
    expect(formats.some(f => f.type === 'case')).toBe(true)
    expect(formats.some(f => f.type === 'statute')).toBe(true)
  })
})

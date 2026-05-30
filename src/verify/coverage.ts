import type { VerifiableCitation } from '../schema.js'
import type { CoverageDeclaration, CoverageResult } from '../sources/types.js'

export const COVERAGE_DECLARATIONS: CoverageDeclaration[] = [
  {
    source: 'CourtListener',
    jurisdictions: ['US', 'US-AL', 'US-AK', 'US-AZ', 'US-AR', 'US-CA', 'US-CO', 'US-CT', 'US-DE', 'US-FL', 'US-GA', 'US-HI', 'US-ID', 'US-IL', 'US-IN', 'US-IA', 'US-KS', 'US-KY', 'US-LA', 'US-ME', 'US-MD', 'US-MA', 'US-MI', 'US-MN', 'US-MS', 'US-MO', 'US-MT', 'US-NE', 'US-NV', 'US-NH', 'US-NJ', 'US-NM', 'US-NY', 'US-NC', 'US-ND', 'US-OH', 'US-OK', 'US-OR', 'US-PA', 'US-RI', 'US-SC', 'US-SD', 'US-TN', 'US-TX', 'US-UT', 'US-VT', 'US-VA', 'US-WA', 'US-WV', 'US-WI', 'US-WY'],
    coverageType: 'partial',
    dateRange: { from: '1754-01-01', to: 'present' },
    updateFrequency: 'daily',
    knownGaps: [
      'Not all state trial courts',
      'Some state appellate coverage gaps',
      'Unpublished opinions may be missing',
      'Tribal courts not covered',
      'Territorial courts (PR, GU, VI) not covered',
    ],
    accessRestrictions: ['2 req/s on free tier', '10 req/s on authenticated tier'],
    confidence: 0.95,
  },
{
    source: 'Google Scholar',
    jurisdictions: ['US', 'AU', 'CA', 'UK'],
    coverageType: 'limited',
    dateRange: { from: '1754-01-01', to: 'present' },
    updateFrequency: 'variable',
    knownGaps: [
      'No official API — web scraping, fragile',
      'Coverage is uneven across jurisdictions',
      'No good-law / treatment information',
      'May be blocked by rate limiting or IP restrictions',
    ],
    accessRestrictions: ['~0.5 req/s (web scraping, use as fallback only)'],
    confidence: 0.7,
  },
]

export function checkCoverage(citation: VerifiableCitation): {
  coveredSources: CoverageDeclaration[]
  uncoveredSources: CoverageDeclaration[]
  bestCoverage: CoverageResult
} {
  const coveredSources: CoverageDeclaration[] = []
  const uncoveredSources: CoverageDeclaration[] = []

  for (const dec of COVERAGE_DECLARATIONS) {
    const jurMatch = dec.jurisdictions.some(j =>
      citation.jurisdiction
        ? j.startsWith(citation.jurisdiction.slice(0, 2)) || citation.jurisdiction.startsWith(j.slice(0, 2))
        : j.startsWith('US')
    )
    const typeMatch = citation.type === 'case' || citation.type === 'statute'

    if (jurMatch && typeMatch) {
      coveredSources.push(dec)
    } else {
      uncoveredSources.push(dec)
    }
  }

  let bestCoverage: CoverageResult = {
    covered: false,
    coverageType: 'none',
    dateRange: { from: '', to: '' },
    confidence: 0,
    gapNote: 'Citation falls outside all source coverage',
  }

  if (coveredSources.length > 0) {
    const best = coveredSources.reduce((a, b) => a.confidence > b.confidence ? a : b)
    bestCoverage = {
      covered: true,
      coverageType: best.coverageType,
      dateRange: { ...best.dateRange },
      confidence: best.confidence,
      gapNote: undefined,
    }
  }

  return { coveredSources, uncoveredSources, bestCoverage }
}

export function formatCoverageMap(): string {
  const lines: string[] = ['LegalVerify — Source Coverage Map', '', `${COVERAGE_DECLARATIONS.length} source(s) configured:`]

  for (const dec of COVERAGE_DECLARATIONS) {
    lines.push(`\n  ${dec.source}${dec.coverageType === 'limited' ? ' (limited)' : ''}`)
    lines.push(`    Jurisdictions: ${dec.jurisdictions.length > 3 ? `${dec.jurisdictions.length} state(s) + federal` : dec.jurisdictions.join(', ')}`)
    lines.push(`    Date range:    ${dec.dateRange.from} – ${dec.dateRange.to}`)
    lines.push(`    Updated:       ${dec.updateFrequency}`)
    lines.push(`    Confidence:    ${(dec.confidence * 100).toFixed(0)}%`)
    if (dec.knownGaps.length > 0) {
      lines.push(`    Known gaps:`)
      for (const gap of dec.knownGaps) {
        lines.push(`      • ${gap}`)
      }
    }
  }

  lines.push(`\n  Local Corpus (if configured)`)
  lines.push(`    Status: Not configured`)
  lines.push(`    Configure: legalverify --corpus ./path/ or LEGALVERIFY_CORPUS_PATH`)

  lines.push(`\n  International coverage: (Phase 2)`)
  lines.push(`    UK:  BAILII`)
  lines.push(`    AU:  AustLII`)
  lines.push(`    CA:  CanLII`)
  lines.push(`    EU:  EUR-Lex`)

  return lines.join('\n')
}

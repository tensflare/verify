import type { VerifiableCitation } from '../schema.js'
import type { SourceAdapter, SourceResult, CoverageResult } from './types.js'
import { checkCoverage } from '../verify/coverage.js'

export class GoogleScholarAdapter implements SourceAdapter {
  readonly name = 'Google Scholar'
  readonly priority = 3
  readonly rateLimit = 2000

  readonly coverage = {
    source: 'Google Scholar',
    jurisdictions: ['US', 'AU', 'CA', 'UK'],
    coverageType: 'limited' as const,
    dateRange: { from: '1754-01-01', to: 'present' },
    updateFrequency: 'variable',
    knownGaps: [
      'No official API — web scraping, fragile',
      'Coverage is uneven across jurisdictions',
    ],
    accessRestrictions: ['~0.5 req/s, fallback only'],
    confidence: 0.7,
  }

  supports(citation: VerifiableCitation): boolean {
    return citation.type === 'case'
  }

  checkCoverage(citation: VerifiableCitation): CoverageResult {
    const { bestCoverage } = checkCoverage(citation)
    return bestCoverage
  }

  async resolve(citation: VerifiableCitation): Promise<SourceResult> {
    const start = Date.now()

    try {
      const query = encodeURIComponent(citation.normalized_text)
      const url = `https://scholar.google.com/scholar?q=${query}&as_sdt=4,33&as_ylo=1750`

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LegalVerify/0.2 (+https://github.com/tensflare/verify)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        return { found: false, error: `HTTP ${response.status}`, responseTimeMs: Date.now() - start }
      }

      const html = await response.text()
      const hasResults = html.includes('class="gs_ri"') || html.includes('id="gs_res_ccl"')

      return {
        found: hasResults,
        url: hasResults ? url : undefined,
        responseTimeMs: Date.now() - start,
      }
    } catch (err) {
      return {
        found: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        responseTimeMs: Date.now() - start,
      }
    }
  }
}

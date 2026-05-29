import type { VerifiableCitation } from '../schema.js'
import type { SourceAdapter, SourceResult, CoverageResult } from './types.js'
import { checkCoverage } from '../verify/coverage.js'

export class CAPAdapter implements SourceAdapter {
  readonly name = 'Harvard Caselaw Access Project'
  readonly priority = 2
  readonly rateLimit = 200

  readonly coverage = {
    source: 'Harvard Caselaw Access Project',
    jurisdictions: ['US'],
    coverageType: 'partial' as const,
    dateRange: { from: '1658-01-01', to: '2018-06-30' },
    updateFrequency: 'static (project concluded)',
    knownGaps: ['No cases after June 2018', 'Some OCR quality issues'],
    accessRestrictions: ['5 req/s'],
    confidence: 0.98,
  }

  supports(citation: VerifiableCitation): boolean {
    return citation.type === 'case' && (!citation.jurisdiction || citation.jurisdiction.startsWith('US'))
  }

  checkCoverage(citation: VerifiableCitation): CoverageResult {
    const { bestCoverage } = checkCoverage(citation)
    return bestCoverage
  }

  async resolve(citation: VerifiableCitation): Promise<SourceResult> {
    const start = Date.now()

    if (!this.supports(citation)) {
      return { found: false, error: 'Unsupported jurisdiction', responseTimeMs: Date.now() - start }
    }

    try {
      const url = `https://api.case.law/v1/cases/?cite=${encodeURIComponent(citation.normalized_text)}&page_size=1&format=json`
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return { found: false, error: `HTTP ${response.status}`, responseTimeMs: Date.now() - start }
      }

      const data = await response.json() as { count: number; results: Array<{ url: string }> }

      return {
        found: data.count > 0,
        url: data.count > 0 ? data.results[0].url : undefined,
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

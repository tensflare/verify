import type { VerifiableCitation } from '../schema.js'
import type { SourceAdapter, SourceResult, CoverageResult } from './types.js'
import { checkCoverage } from '../verify/coverage.js'

export class CourtListenerAdapter implements SourceAdapter {
  readonly name = 'CourtListener'
  readonly priority = 1
  readonly rateLimit = 500

  readonly coverage = {
    source: 'CourtListener',
    jurisdictions: ['US'],
    coverageType: 'partial' as const,
    dateRange: { from: '1754-01-01', to: 'present' },
    updateFrequency: 'daily',
    knownGaps: ['Not all state trial courts', 'Tribal courts not covered'],
    accessRestrictions: ['2 req/s on free tier'],
    confidence: 0.95,
  }

  private baseUrl = 'https://www.courtlistener.com/api/rest/v3'
  private apiKey: string

  constructor() {
    this.apiKey = process.env['COURTLISTENER_API_KEY'] ?? ''
  }

  supports(citation: VerifiableCitation): boolean {
    return citation.type === 'case' && (!citation.jurisdiction || citation.jurisdiction === 'US' || citation.jurisdiction.startsWith('US-'))
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

    const coverage = this.checkCoverage(citation)
    if (!coverage.covered) {
      return { found: false, error: 'Outside coverage', coverageNote: coverage.gapNote, responseTimeMs: Date.now() - start }
    }

    try {
      const url = `${this.baseUrl}/opinions/?citation=${encodeURIComponent(citation.normalized_text)}&format=json`
      const response = await fetch(url, {
        headers: this.apiKey ? { Authorization: `Token ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return { found: false, error: `HTTP ${response.status}`, responseTimeMs: Date.now() - start }
      }

      const data = await response.json() as { count: number; results: Array<{ id: number; case_name: string }> }

      return {
        found: data.count > 0,
        url: data.count > 0 ? `https://www.courtlistener.com/opinion/${data.results[0].id}/` : undefined,
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

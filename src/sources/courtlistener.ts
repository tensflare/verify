import type { VerifiableCitation } from '../schema.js'
import type { SourceAdapter, SourceResult, CoverageResult } from './types.js'
import { checkCoverage } from '../verify/coverage.js'

interface CitationLookupResult {
  citation: string
  normalized_citations: string[]
  start_index: number
  end_index: number
  status: number
  error_message: string
  clusters: Array<{
    id: number
    case_name: string
    absolute_url: string
  }>
}

export class CourtListenerAdapter implements SourceAdapter {
  readonly name = 'CourtListener'
  readonly priority = 1
  readonly rateLimit = 1000

  readonly coverage = {
    source: 'CourtListener',
    jurisdictions: ['US'],
    coverageType: 'partial' as const,
    dateRange: { from: '1658-01-01', to: 'present' },
    updateFrequency: 'daily',
    knownGaps: ['Not all state trial courts', 'Tribal courts not covered'],
    accessRestrictions: ['Token auth required', '60 citations/min on free tier'],
    confidence: 0.97,
  }

  private baseUrl = 'https://www.courtlistener.com/api/rest/v4'
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

    if (!this.apiKey) {
      return { found: false, error: 'COURTLISTENER_API_KEY not configured', responseTimeMs: Date.now() - start }
    }

    const coverage = this.checkCoverage(citation)
    if (!coverage.covered) {
      return { found: false, error: 'Outside coverage', coverageNote: coverage.gapNote, responseTimeMs: Date.now() - start }
    }

    try {
      const url = `${this.baseUrl}/citation-lookup/`
      const body = new URLSearchParams({ text: citation.normalized_text })
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return { found: false, error: `HTTP ${response.status}${text ? ': ' + text.slice(0, 200) : ''}`, responseTimeMs: Date.now() - start }
      }

      const data = await response.json() as CitationLookupResult[]
      const result = data[0]

      if (!result) {
        return { found: false, error: 'No citation found in response', responseTimeMs: Date.now() - start }
      }

      if (result.status === 200) {
        const cluster = result.clusters?.[0]
        return {
          found: true,
          url: cluster?.absolute_url ?? `https://www.courtlistener.com/opinion/${cluster?.id}/`,
          responseTimeMs: Date.now() - start,
        }
      }

      if (result.status === 300) {
        return {
          found: true,
          url: result.clusters?.[0]?.absolute_url,
          responseTimeMs: Date.now() - start,
        }
      }

      if (result.status === 404) {
        return { found: false, responseTimeMs: Date.now() - start }
      }

      return {
        found: false,
        error: result.error_message || `Citation lookup returned status ${result.status}`,
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

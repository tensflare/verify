import { v4 as uuidv4 } from 'uuid'
import type { VerifiableCitation, CitationVerification, SourceCheck } from '../schema.js'
import type { SourceAdapter } from '../sources/types.js'
import { CourtListenerAdapter } from '../sources/courtlistener.js'
import { CAPAdapter } from '../sources/cap.js'
import { GoogleScholarAdapter } from '../sources/google-scholar.js'
import { LocalCorpusAdapter } from '../sources/local-corpus.js'
import { checkCoverage } from './coverage.js'

export class SourceResolver {
  private adapters: SourceAdapter[]

  constructor(adapters?: SourceAdapter[]) {
    this.adapters = adapters ?? [
      new LocalCorpusAdapter(),
      new CourtListenerAdapter(),
      new CAPAdapter(),
      new GoogleScholarAdapter(),
    ]
  }

  async resolve(citation: VerifiableCitation): Promise<CitationVerification> {
    const applicable = this.adapters
      .filter(a => a.supports(citation))
      .sort((a, b) => a.priority - b.priority)

    if (applicable.length === 0) {
      const coverage = checkCoverage(citation)
      return {
        id: uuidv4(),
        citation,
        status: 'unverifiable',
        confidence: 0,
        sources_checked: [],
        coverage_note: coverage.bestCoverage.gapNote ?? 'No source adapter supports this citation type or jurisdiction',
        checked_at: new Date().toISOString(),
      }
    }

    const sourcesChecked: SourceCheck[] = []
    let found = false
    let matchedText: string | undefined
    let bestUrl: string | undefined

    for (const adapter of applicable) {
      if (adapter.rateLimit > 0 && sourcesChecked.length > 0) {
        await delay(adapter.rateLimit)
      }

      const coverage = adapter.checkCoverage(citation)
      if (!coverage.covered) {
        sourcesChecked.push({
          source_name: adapter.name,
          coverage,
          found: false,
          response_time_ms: 0,
        })
        continue
      }

      const result = await adapter.resolve(citation)

      sourcesChecked.push({
        source_name: adapter.name,
        coverage,
        found: result.found,
        url: result.url,
        error: result.error,
        response_time_ms: result.responseTimeMs,
      })

      if (result.found && !found) {
        found = true
        matchedText = result.matchedText
        bestUrl = result.url
      }
    }

    const allErrored = sourcesChecked.length > 0 && sourcesChecked.every(s => s.error)
    const someCovered = sourcesChecked.some(s => s.coverage.covered)

    let status: CitationVerification['status']
    let confidence: number

    if (!someCovered) {
      status = 'unverifiable'
      confidence = 0
    } else if (found) {
      status = 'verified'
      confidence = calculateConfidence(sourcesChecked)
    } else if (allErrored) {
      status = 'unverifiable'
      confidence = 0.3
    } else {
      status = 'hallucinated'
      confidence = Math.round((1 - sourcesChecked.filter(s => s.coverage.covered && !s.error).reduce((sum, s) => sum + s.coverage.confidence, 0) / Math.max(1, sourcesChecked.filter(s => s.coverage.covered && !s.error).length)) * 100) / 100
    }

    return {
      id: uuidv4(),
      citation,
      status,
      confidence,
      sources_checked: sourcesChecked,
      matched_source_text: matchedText,
      checked_at: new Date().toISOString(),
    }
  }
}

function calculateConfidence(sources: SourceCheck[]): number {
  const covered = sources.filter(s => s.coverage.covered && !s.error)
  if (covered.length === 0) return 0

  const found = sources.filter(s => s.found).length
  const total = covered.length
  let score = found / total

  if (found >= 2 && total >= 3) {
    score = Math.min(1.0, score + 0.15)
  }

  return Math.round(score * 100) / 100
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

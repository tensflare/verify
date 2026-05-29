import type { VerifiableCitation } from '../schema.js'
import type { SourceAdapter, SourceResult, CoverageResult } from './types.js'

export class LocalCorpusAdapter implements SourceAdapter {
  readonly name = 'Local Corpus'
  readonly priority = 0
  readonly rateLimit = 0

  readonly coverage = {
    source: 'Local Corpus',
    jurisdictions: ['*'],
    coverageType: 'partial' as const,
    dateRange: { from: '0000-01-01', to: 'present' },
    updateFrequency: 'user-defined',
    knownGaps: ['Only contains documents indexed by the user'],
    accessRestrictions: ['Local disk only'],
    confidence: 0.9,
  }

  private corpusPath: string

  constructor(corpusPath?: string) {
    this.corpusPath = corpusPath ?? process.env['LEGALVERIFY_CORPUS_PATH'] ?? ''
  }

  isConfigured(): boolean {
    return this.corpusPath !== ''
  }

  supports(citation: VerifiableCitation): boolean {
    return this.isConfigured() && citation.type === 'case'
  }

  checkCoverage(citation: VerifiableCitation): CoverageResult {
    if (!this.isConfigured()) {
      return { covered: false, coverageType: 'none', dateRange: { from: '', to: '' }, confidence: 0, gapNote: 'Local corpus not configured' }
    }
    return { covered: true, coverageType: 'partial', dateRange: { from: '0000-01-01', to: 'present' }, confidence: 0.85 }
  }

  async resolve(citation: VerifiableCitation): Promise<SourceResult> {
    const start = Date.now()

    if (!this.isConfigured()) {
      return { found: false, error: 'Local corpus not configured', responseTimeMs: Date.now() - start }
    }

    try {
      const { Duct } = await import('@docfide/duct')
      const duct = new Duct({ persistPath: this.corpusPath })
      await duct.index(this.corpusPath)
      const results = await duct.search(citation.normalized_text, 5)

      const match = results.find(r =>
        r.chunk.content.toLowerCase().includes(citation.normalized_text.toLowerCase())
      )

      return {
        found: !!match,
        matchedText: match?.chunk.content,
        responseTimeMs: Date.now() - start,
      }
    } catch (err) {
      return {
        found: false,
        error: err instanceof Error ? err.message : 'Local corpus unavailable',
        responseTimeMs: Date.now() - start,
      }
    }
  }
}

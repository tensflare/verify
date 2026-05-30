import { createHash } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import type { VerifiableCitation, DocumentVerification, CitationVerification, ComplianceReport, ComplianceStandard } from './schema.js'
import { extractCitations } from './verify/parser.js'
import { SourceResolver } from './verify/resolver.js'
import { checkCoverage } from './verify/coverage.js'
import { SCOPE_SHORT } from './verify/scope.js'
import { generateComplianceReport } from './compliance/rules.js'
import type { SourceAdapter } from './sources/types.js'

export class CitationVerifier {
  private resolver: SourceResolver

  constructor(options?: { corpusPath?: string; adapters?: SourceAdapter[] }) {
    this.resolver = new SourceResolver(options?.adapters)
  }

  async verifyText(text: string, options?: { documentName?: string }): Promise<DocumentVerification> {
    const start = Date.now()
    const docHash = createHash('sha256').update(text).digest('hex')

    const extracted = extractCitations(text)

    const seen = new Set<string>()
    const uniqueCitations = extracted.filter(e => {
      const key = e.citation.normalized_text.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const verifications = await Promise.all(
      uniqueCitations.map(async (e) => {
        return this.resolver.resolve(e.citation)
      })
    )

    const verified = verifications.filter(v => v.status === 'verified').length
    const hallucinated = verifications.filter(v => v.status === 'hallucinated').length
    const misattributed = verifications.filter(v => v.status === 'misattributed').length
    const unverifiable = verifications.filter(v => v.status === 'unverifiable').length
    const pending = verifications.filter(v => v.status === 'pending').length

    const overallScore = verifications.length > 0
      ? verifications.reduce((sum, v) => sum + v.confidence, 0) / verifications.length
      : 0

    const coveredCount = verifications.filter(v => v.sources_checked.some(s => s.coverage.covered)).length
    const partialCount = verifications.filter(v => v.sources_checked.length > 0 && !v.sources_checked.every(s => s.coverage.covered)).length
    const uncoveredCount = verifications.filter(v => v.sources_checked.length === 0).length

    return {
      id: uuidv4(),
      document_name: options?.documentName ?? 'inline',
      document_hash: docHash,
      total_citations: verifications.length,
      verified_count: verified,
      hallucinated_count: hallucinated,
      misattributed_count: misattributed,
      unverifiable_count: unverifiable,
      pending_count: pending,
      overall_score: Math.round(overallScore * 100) / 100,
      coverage_summary: {
        covered: coveredCount,
        partial: partialCount,
        uncovered: uncoveredCount,
      },
      citations: verifications,
      checked_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      scope_notice: SCOPE_SHORT,
    }
  }

  async verifyCitation(text: string): Promise<CitationVerification> {
    const parsed: VerifiableCitation = {
      raw_text: text,
      normalized_text: text.trim().replace(/[.,;:]+$/, '').replace(/\s+/g, ' '),
      type: 'case',
    }
    return this.resolver.resolve(parsed)
  }

  async verifyAndComply(
    text: string,
    options?: { documentName?: string; standard?: ComplianceStandard; jurisdiction?: string },
  ): Promise<{ verification: DocumentVerification; compliance: ComplianceReport }> {
    const verification = await this.verifyText(text, { documentName: options?.documentName })
    const compliance = await generateComplianceReport(verification, {
      standard: options?.standard,
      jurisdiction: options?.jurisdiction,
    })
    return { verification, compliance }
  }
}

export { extractCitations } from './verify/parser.js'
export { formatCoverageMap, COVERAGE_DECLARATIONS, checkCoverage } from './verify/coverage.js'
export { formatScopeNotice, SCOPE_SHORT, SCOPE_NOTICE } from './verify/scope.js'
export { SourceResolver } from './verify/resolver.js'
export { CourtListenerAdapter } from './sources/courtlistener.js'
export { GoogleScholarAdapter } from './sources/google-scholar.js'
export { LocalCorpusAdapter } from './sources/local-corpus.js'
export { SqliteStore } from './store/sqlite.js'
export { generateComplianceReport, listRuleSets, getRuleSet } from './compliance/rules.js'
export type { Store } from './store/index.js'
export type { ComplianceStandard }

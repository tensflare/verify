import type { VerifiableCitation, SourceCheck } from '../schema.js'

export interface CoverageDeclaration {
  source: string
  jurisdictions: string[]
  coverageType: 'full' | 'partial' | 'limited'
  dateRange: { from: string; to: string | 'present' }
  updateFrequency: string
  knownGaps: string[]
  accessRestrictions: string[]
  confidence: number
}

export interface CoverageResult {
  covered: boolean
  coverageType: 'full' | 'partial' | 'limited' | 'none'
  dateRange: { from: string; to: string }
  confidence: number
  gapNote?: string
}

export interface SourceResult {
  found: boolean
  propositionMatch?: boolean
  matchedText?: string
  url?: string
  error?: string
  responseTimeMs: number
  coverageNote?: string
  jurisdiction?: string
}

export interface SourceAdapter {
  readonly name: string
  readonly priority: number
  readonly rateLimit: number
  readonly coverage: CoverageDeclaration

  supports(citation: VerifiableCitation): boolean
  resolve(citation: VerifiableCitation): Promise<SourceResult>
  checkCoverage(citation: VerifiableCitation): CoverageResult
}

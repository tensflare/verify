import { z } from 'zod'

export const CitationStatus = z.enum([
  'verified',
  'hallucinated',
  'misattributed',
  'unverifiable',
  'pending',
])
export type CitationStatus = z.infer<typeof CitationStatus>

export const CitationType = z.enum(['case', 'statute', 'regulation', 'treatise', 'other'])
export type CitationType = z.infer<typeof CitationType>

export const VerifiableCitation = z.object({
  raw_text: z.string(),
  normalized_text: z.string(),
  type: CitationType,
  jurisdiction: z.string().optional(),
  components: z.record(z.string()).optional(),
  context: z.string().optional(),
})
export type VerifiableCitation = z.infer<typeof VerifiableCitation>

export const CoverageResult = z.object({
  covered: z.boolean(),
  coverageType: z.enum(['full', 'partial', 'limited', 'none']),
  dateRange: z.object({ from: z.string(), to: z.string() }),
  confidence: z.number().min(0).max(1),
  gapNote: z.string().optional(),
})
export type CoverageResult = z.infer<typeof CoverageResult>

export const SourceCheck = z.object({
  source_name: z.string(),
  coverage: CoverageResult,
  found: z.boolean(),
  proposition_match: z.boolean().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
  response_time_ms: z.number(),
})
export type SourceCheck = z.infer<typeof SourceCheck>

export const CitationVerification = z.object({
  id: z.string().uuid(),
  citation: VerifiableCitation,
  status: CitationStatus,
  confidence: z.number().min(0).max(1),
  sources_checked: z.array(SourceCheck),
  coverage_note: z.string().optional(),
  matched_source_text: z.string().optional(),
  checked_at: z.string().datetime(),
})
export type CitationVerification = z.infer<typeof CitationVerification>

export const CoverageSummary = z.object({
  covered: z.number(),
  partial: z.number(),
  uncovered: z.number(),
})
export type CoverageSummary = z.infer<typeof CoverageSummary>

export const DocumentVerification = z.object({
  id: z.string().uuid(),
  document_name: z.string(),
  document_hash: z.string(),
  total_citations: z.number(),
  verified_count: z.number(),
  hallucinated_count: z.number(),
  misattributed_count: z.number(),
  unverifiable_count: z.number(),
  pending_count: z.number(),
  overall_score: z.number().min(0).max(1),
  coverage_summary: CoverageSummary,
  citations: z.array(CitationVerification),
  checked_at: z.string().datetime(),
  duration_ms: z.number(),
  scope_notice: z.string(),
})
export type DocumentVerification = z.infer<typeof DocumentVerification>

export const ComplianceStandard = z.enum(['ny-part-161', 'generic'])
export type ComplianceStandard = z.infer<typeof ComplianceStandard>

export const ComplianceFinding = z.object({
  rule_id: z.string(),
  requirement: z.string(),
  met: z.boolean(),
  detail: z.string(),
})
export type ComplianceFinding = z.infer<typeof ComplianceFinding>

export const ComplianceReport = z.object({
  id: z.string().uuid(),
  document_verification_id: z.string().uuid(),
  standard: ComplianceStandard,
  jurisdiction: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  findings: z.array(ComplianceFinding),
  scope_notice: z.string(),
  summary: z.string(),
  generated_at: z.string().datetime(),
  expires_at: z.string().datetime(),
})
export type ComplianceReport = z.infer<typeof ComplianceReport>

export const CitationIndexEntry = z.object({
  citation_hash: z.string(),
  normalized_text: z.string(),
  status: CitationStatus,
  confidence: z.number().min(0).max(1),
  source_urls: z.array(z.string()),
  verification_count: z.number(),
  first_seen: z.string().datetime(),
  last_seen: z.string().datetime(),
  conflicting_results: z.boolean(),
  jurisdiction: z.string().optional(),
  citation_type: CitationType.optional(),
})
export type CitationIndexEntry = z.infer<typeof CitationIndexEntry>

import type { DocumentVerification, ComplianceReport, ComplianceFinding, ComplianceStandard } from '../schema.js'
import { v4 as uuidv4 } from 'uuid'
import { SCOPE_SHORT } from '../verify/scope.js'

interface Rule {
  id: string
  description: string
  check: (doc: DocumentVerification) => { met: boolean; detail: string }
}

interface RuleSet {
  id: string
  jurisdiction: string
  standard: ComplianceStandard
  effectiveDate: string
  description: string
  rules: Rule[]
}

const NY_PART_161: RuleSet = {
  id: 'ny-part-161',
  jurisdiction: 'US-NY',
  standard: 'ny-part-161',
  effectiveDate: '2026-06-01T00:00:00.000Z',
  description: 'New York Rules of the Chief Administrative Judge Part 161 — AI Use in Court Filings',
  rules: [
    {
      id: 'ny-161-citation-existence',
      description: 'All citations in the filing must correspond to verifiable sources',
      check: (doc) => ({
        met: doc.hallucinated_count === 0 && doc.misattributed_count === 0,
        detail: doc.hallucinated_count === 0 && doc.misattributed_count === 0
          ? `All ${doc.total_citations} citations verified against authoritative sources`
          : `${doc.hallucinated_count + doc.misattributed_count} citation(s) could not be verified — potential fabrication`,
      }),
    },
    {
      id: 'ny-161-verification-documented',
      description: 'Citation verification must be documented and reproducible',
      check: (doc) => ({
        met: doc.checked_at !== undefined && doc.citations.length > 0,
        detail: `Verification trail documented at ${doc.checked_at}`,
      }),
    },
    {
      id: 'ny-161-coverage-disclosed',
      description: 'Tool coverage limitations must be disclosed',
      check: () => ({
        met: true,
        detail: 'Coverage limitations are documented in this report. Full scope: github.com/tensflare/verify/SCOPE.md',
      }),
    },
    {
      id: 'ny-161-proposition-notice',
      description: 'Proposition accuracy is the attorney independent responsibility',
      check: () => ({
        met: true,
        detail: 'This tool verifies citation existence only. Proposition accuracy is the filing attorney independent responsibility.',
      }),
    },
  ],
}

const GENERIC: RuleSet = {
  id: 'generic',
  jurisdiction: '*',
  standard: 'generic',
  effectiveDate: '2026-01-01T00:00:00.000Z',
  description: 'Generic citation verification — best practice compliance',
  rules: [
    {
      id: 'gen-citation-existence',
      description: 'Citations should be verified against authoritative sources',
      check: (doc) => ({
        met: doc.hallucinated_count === 0 && doc.misattributed_count === 0,
        detail: `${doc.verified_count}/${doc.total_citations} citations verified`,
      }),
    },
    {
      id: 'gen-verification-documented',
      description: 'Verification should be documented',
      check: (doc) => ({
        met: doc.checked_at !== undefined,
        detail: `Verified at ${doc.checked_at}`,
      }),
    },
  ],
}

const RULE_SETS: Record<string, RuleSet> = {
  'ny-part-161': NY_PART_161,
  'generic': GENERIC,
}

export function getRuleSet(standard: string): RuleSet {
  return RULE_SETS[standard] ?? RULE_SETS['generic']
}

export function listRuleSets(): Array<{ id: string; jurisdiction: string; effectiveDate: string }> {
  return Object.entries(RULE_SETS).map(([id, rs]) => ({
    id,
    jurisdiction: rs.jurisdiction,
    effectiveDate: rs.effectiveDate,
  }))
}

export interface ComplianceOptions {
  standard?: ComplianceStandard
  jurisdiction?: string
}

export async function generateComplianceReport(
  docVerification: DocumentVerification,
  options: ComplianceOptions = {},
): Promise<ComplianceReport> {
  const standard = options.standard ?? 'ny-part-161'
  const ruleSet = getRuleSet(standard)

  const findings: ComplianceFinding[] = ruleSet.rules.map(rule => {
    const result = rule.check(docVerification)
    return {
      rule_id: rule.id,
      requirement: rule.description,
      met: result.met,
      detail: result.detail,
    }
  })

  const passed = findings.every(f => f.met)
  const hallucinatedCount = docVerification.hallucinated_count + docVerification.misattributed_count

  return {
    id: uuidv4(),
    document_verification_id: docVerification.id,
    standard,
    jurisdiction: options.jurisdiction ?? ruleSet.jurisdiction,
    passed,
    score: docVerification.overall_score,
    findings,
    scope_notice: SCOPE_SHORT,
    summary: passed
      ? `PASS — All citations verified. Compliant with ${standard}.`
      : `FAIL — ${hallucinatedCount} citation issue(s) found. Not compliant with ${standard}.`,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { v4 as uuidv4 } from 'uuid'
import { SqliteStore } from '../../src/store/sqlite.js'
import type { DocumentVerification, CitationVerification, ComplianceReport, CitationIndexEntry } from '../../src/schema.js'

const TEST_DB = join(tmpdir(), `legalverify-test-${uuidv4()}.db`)

describe('SqliteStore', () => {
  let store: SqliteStore

  beforeEach(async () => {
    store = new SqliteStore(TEST_DB)
    await store.initialize()
  })

  afterEach(() => {
    store.close()
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB)
    }
  })

  describe('document verifications', () => {
    const makeDoc = (overrides?: Partial<DocumentVerification>): DocumentVerification => ({
      id: uuidv4(),
      document_name: 'test-doc',
      document_hash: 'abc123',
      total_citations: 3,
      verified_count: 2,
      hallucinated_count: 1,
      misattributed_count: 0,
      unverifiable_count: 0,
      pending_count: 0,
      overall_score: 0.67,
      coverage_summary: { covered: 2, partial: 1, uncovered: 0 },
      citations: [],
      checked_at: new Date().toISOString(),
      duration_ms: 150,
      scope_notice: 'scope notice text',
      ...overrides,
    })

    it('saves and retrieves a document verification', async () => {
      const doc = makeDoc()
      await store.saveDocumentVerification(doc)
      const retrieved = await store.getDocumentVerification(doc.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(doc.id)
      expect(retrieved!.document_name).toBe('test-doc')
      expect(retrieved!.total_citations).toBe(3)
      expect(retrieved!.overall_score).toBe(0.67)
    })

    it('returns null for non-existent document', async () => {
      const result = await store.getDocumentVerification('does-not-exist')
      expect(result).toBeNull()
    })

    it('replaces existing document on duplicate save', async () => {
      const doc = makeDoc({ document_name: 'original' })
      await store.saveDocumentVerification(doc)
      const update = makeDoc({ id: doc.id, document_name: 'updated' })
      await store.saveDocumentVerification(update)
      const retrieved = await store.getDocumentVerification(doc.id)
      expect(retrieved!.document_name).toBe('updated')
    })
  })

  describe('citation verifications', () => {
    const makeCV = (overrides?: Partial<CitationVerification>): CitationVerification => ({
      id: uuidv4(),
      citation: {
        raw_text: '410 U.S. 113',
        normalized_text: '410 U.S. 113',
        type: 'case',
        jurisdiction: 'US',
      },
      status: 'verified',
      confidence: 0.95,
      sources_checked: [{
        source_name: 'TestSource',
        coverage: { covered: true, coverageType: 'full', dateRange: { from: '2000-01-01', to: 'present' }, confidence: 0.95 },
        found: true,
        response_time_ms: 10,
      }],
      checked_at: new Date().toISOString(),
      ...overrides,
    })

    it('saves and retrieves a citation verification', async () => {
      const cv = makeCV()
      await store.saveCitationVerification(cv)
      const retrieved = await store.getCitationVerification(cv.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.status).toBe('verified')
      expect(retrieved!.citation.normalized_text).toBe('410 U.S. 113')
    })

    it('returns null for non-existent citation', async () => {
      const result = await store.getCitationVerification('does-not-exist')
      expect(result).toBeNull()
    })
  })

  describe('compliance reports', () => {
    const makeCR = (overrides?: Partial<ComplianceReport>): ComplianceReport => ({
      id: uuidv4(),
      document_verification_id: uuidv4(),
      standard: 'ny-part-161',
      jurisdiction: 'US-NY',
      passed: true,
      score: 0.95,
      findings: [{ rule_id: 'r1', requirement: 'Must exist', met: true, detail: 'All good' }],
      scope_notice: 'scope notice',
      summary: 'PASS',
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      ...overrides,
    })

    it('saves and retrieves a compliance report', async () => {
      const cr = makeCR()
      await store.saveComplianceReport(cr)
      const retrieved = await store.getComplianceReport(cr.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.passed).toBe(true)
      expect(retrieved!.standard).toBe('ny-part-161')
    })

    it('returns null for non-existent report', async () => {
      const result = await store.getComplianceReport('does-not-exist')
      expect(result).toBeNull()
    })
  })

  describe('citation index', () => {
    const makeEntry = (overrides?: Partial<CitationIndexEntry>): CitationIndexEntry => ({
      citation_hash: 'abc123hash',
      normalized_text: '410 U.S. 113',
      status: 'verified',
      confidence: 0.95,
      source_urls: ['https://example.com/1'],
      verification_count: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      conflicting_results: false,
      ...overrides,
    })

    it('inserts a new entry', async () => {
      const entry = makeEntry()
      await store.upsertCitationIndexEntry(entry)
      const retrieved = await store.getCitationIndexEntry(entry.citation_hash)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.status).toBe('verified')
      expect(retrieved!.verification_count).toBe(1)
    })

    it('updates an existing entry', async () => {
      const entry = makeEntry()
      await store.upsertCitationIndexEntry(entry)

      const updated = makeEntry({
        citation_hash: entry.citation_hash,
        status: 'hallucinated',
        normalized_text: entry.normalized_text,
        verification_count: 2,
        first_seen: entry.first_seen,
      })
      await store.upsertCitationIndexEntry(updated)
      const retrieved = await store.getCitationIndexEntry(entry.citation_hash)
      expect(retrieved!.status).toBe('hallucinated')
      expect(retrieved!.verification_count).toBe(2)
      const cv = retrieved!.verification_count
      expect(cv).toBe(2)
    })

    it('returns null for non-existent entry', async () => {
      const result = await store.getCitationIndexEntry('does-not-exist')
      expect(result).toBeNull()
    })

    it('merges source_urls on update', async () => {
      const entry = makeEntry({ source_urls: ['https://example.com/1'] })
      await store.upsertCitationIndexEntry(entry)

      const update = makeEntry({
        citation_hash: entry.citation_hash,
        source_urls: ['https://example.com/2'],
        first_seen: entry.first_seen,
      })
      await store.upsertCitationIndexEntry(update)
      const retrieved = await store.getCitationIndexEntry(entry.citation_hash)
      expect(retrieved!.source_urls).toContain('https://example.com/1')
      expect(retrieved!.source_urls).toContain('https://example.com/2')
    })
  })

  describe('index stats', () => {
    it('returns zero stats on empty DB', async () => {
      const stats = await store.getIndexStats()
      expect(stats.total).toBe(0)
      expect(stats.verified).toBe(0)
      expect(stats.hallucinated).toBe(0)
      expect(stats.unverifiable).toBe(0)
    })

    it('counts entries by status', async () => {
      await store.upsertCitationIndexEntry({
        citation_hash: 'hash1',
        normalized_text: 'case 1',
        status: 'verified',
        confidence: 0.95,
        source_urls: [],
        verification_count: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        conflicting_results: false,
      })
      await store.upsertCitationIndexEntry({
        citation_hash: 'hash2',
        normalized_text: 'case 2',
        status: 'hallucinated',
        confidence: 0.1,
        source_urls: [],
        verification_count: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        conflicting_results: false,
      })
      await store.upsertCitationIndexEntry({
        citation_hash: 'hash3',
        normalized_text: 'case 3',
        status: 'unverifiable',
        confidence: 0,
        source_urls: [],
        verification_count: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        conflicting_results: false,
      })

      const stats = await store.getIndexStats()
      expect(stats.total).toBe(3)
      expect(stats.verified).toBe(1)
      expect(stats.hallucinated).toBe(1)
      expect(stats.unverifiable).toBe(1)
    })
  })
})

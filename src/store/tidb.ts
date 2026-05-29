import { createPool, type Pool } from 'mysql2/promise'
import type { DocumentVerification, CitationVerification, ComplianceReport, CitationIndexEntry } from '../schema.js'
import type { Store } from './index.js'
import type { MagicToken } from '../auth/magic.js'
import type { ApiKey } from '../auth/keys.js'

export class TiDBStore implements Store {
  private pool: Pool

  constructor() {
    this.pool = createPool({
      host: process.env['TIDB_HOST'] ?? 'localhost',
      port: Number(process.env['TIDB_PORT'] ?? 4000),
      user: process.env['TIDB_USER'] ?? 'root',
      password: process.env['TIDB_PASSWORD'] ?? '',
      database: process.env['TIDB_DATABASE'] ?? 'legalverify',
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      enableKeepAlive: true,
    })
  }

  async initialize(): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS document_verifications (
          id VARCHAR(36) PRIMARY KEY,
          document_name TEXT NOT NULL,
          document_hash TEXT NOT NULL,
          total_citations INT NOT NULL,
          verified_count INT NOT NULL DEFAULT 0,
          hallucinated_count INT NOT NULL DEFAULT 0,
          misattributed_count INT NOT NULL DEFAULT 0,
          unverifiable_count INT NOT NULL DEFAULT 0,
          pending_count INT NOT NULL DEFAULT 0,
          overall_score DOUBLE NOT NULL,
          coverage_summary TEXT NOT NULL,
          citations TEXT NOT NULL,
          checked_at TEXT NOT NULL,
          duration_ms INT NOT NULL,
          scope_notice TEXT NOT NULL
        )
      `)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS citation_verifications (
          id VARCHAR(36) PRIMARY KEY,
          document_verification_id VARCHAR(36),
          raw_text TEXT NOT NULL,
          normalized_text TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          jurisdiction VARCHAR(50),
          components TEXT,
          context TEXT,
          status VARCHAR(50) NOT NULL,
          confidence DOUBLE NOT NULL,
          sources_checked TEXT NOT NULL,
          coverage_note TEXT,
          matched_source_text TEXT,
          checked_at TEXT NOT NULL
        )
      `)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS compliance_reports (
          id VARCHAR(36) PRIMARY KEY,
          document_verification_id VARCHAR(36) NOT NULL,
          standard VARCHAR(100) NOT NULL,
          jurisdiction VARCHAR(50) NOT NULL,
          passed TINYINT(1) NOT NULL,
          score DOUBLE NOT NULL,
          findings TEXT NOT NULL,
          scope_notice TEXT NOT NULL,
          summary TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        )
      `)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS citation_index (
          citation_hash VARCHAR(64) PRIMARY KEY,
          normalized_text TEXT NOT NULL,
          status VARCHAR(50) NOT NULL,
          confidence DOUBLE NOT NULL DEFAULT 0.0,
          source_urls TEXT NOT NULL DEFAULT '[]',
          verification_count INT NOT NULL DEFAULT 1,
          first_seen TEXT NOT NULL,
          last_seen TEXT NOT NULL,
          conflicting_results TINYINT(1) NOT NULL DEFAULT 0,
          jurisdiction VARCHAR(50),
          citation_type VARCHAR(50)
        )
      `)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS magic_tokens (
          token_hash VARCHAR(64) PRIMARY KEY,
          email TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used TINYINT(1) NOT NULL DEFAULT 0
        )
      `)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id VARCHAR(36) PRIMARY KEY,
          key_prefix TEXT NOT NULL,
          key_hash VARCHAR(64) NOT NULL UNIQUE,
          label TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_used_at TEXT,
          revoked TINYINT(1) NOT NULL DEFAULT 0
        )
      `)
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_mt_email ON magic_tokens(email(255))`)
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_ak_prefix ON api_keys(key_prefix(255))`)
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_ci_status ON citation_index(status(50))`)
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_cv_hash ON citation_verifications(normalized_text(255))`)
      await conn.execute(`CREATE INDEX IF NOT EXISTS idx_dv_hash ON document_verifications(document_hash(255))`)
    } finally {
      conn.release()
    }
  }

  async saveDocumentVerification(dv: DocumentVerification): Promise<void> {
    await this.pool.execute(`
      REPLACE INTO document_verifications
      (id, document_name, document_hash, total_citations, verified_count, hallucinated_count,
       misattributed_count, unverifiable_count, pending_count, overall_score,
       coverage_summary, citations, checked_at, duration_ms, scope_notice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dv.id, dv.document_name, dv.document_hash, dv.total_citations,
      dv.verified_count, dv.hallucinated_count, dv.misattributed_count,
      dv.unverifiable_count, dv.pending_count, dv.overall_score,
      JSON.stringify(dv.coverage_summary), JSON.stringify(dv.citations),
      dv.checked_at, dv.duration_ms, dv.scope_notice,
    ])
  }

  async getDocumentVerification(id: string): Promise<DocumentVerification | null> {
    const [rows] = await this.pool.execute('SELECT * FROM document_verifications WHERE id = ?', [id])
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) return null
    return rowToDocumentVerification(row)
  }

  async saveCitationVerification(cv: CitationVerification): Promise<void> {
    await this.pool.execute(`
      REPLACE INTO citation_verifications
      (id, raw_text, normalized_text, type, jurisdiction, components, context,
       status, confidence, sources_checked, coverage_note, matched_source_text, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cv.id, cv.citation.raw_text, cv.citation.normalized_text, cv.citation.type,
      cv.citation.jurisdiction ?? null, cv.citation.components ? JSON.stringify(cv.citation.components) : null,
      cv.citation.context ?? null, cv.status, cv.confidence,
      JSON.stringify(cv.sources_checked), cv.coverage_note ?? null,
      cv.matched_source_text ?? null, cv.checked_at,
    ])
  }

  async getCitationVerification(id: string): Promise<CitationVerification | null> {
    const [rows] = await this.pool.execute('SELECT * FROM citation_verifications WHERE id = ?', [id])
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) return null
    return rowToCitationVerification(row)
  }

  async saveComplianceReport(cr: ComplianceReport): Promise<void> {
    await this.pool.execute(`
      REPLACE INTO compliance_reports
      (id, document_verification_id, standard, jurisdiction, passed, score,
       findings, scope_notice, summary, generated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cr.id, cr.document_verification_id, cr.standard, cr.jurisdiction,
      cr.passed ? 1 : 0, cr.score, JSON.stringify(cr.findings),
      cr.scope_notice, cr.summary, cr.generated_at, cr.expires_at,
    ])
  }

  async getComplianceReport(id: string): Promise<ComplianceReport | null> {
    const [rows] = await this.pool.execute('SELECT * FROM compliance_reports WHERE id = ?', [id])
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) return null
    return rowToComplianceReport(row)
  }

  async getCitationIndexEntry(hash: string): Promise<CitationIndexEntry | null> {
    const [rows] = await this.pool.execute('SELECT * FROM citation_index WHERE citation_hash = ?', [hash])
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) return null
    return rowToIndexEntry(row)
  }

  async upsertCitationIndexEntry(entry: CitationIndexEntry): Promise<void> {
    const [existing] = await this.pool.execute('SELECT * FROM citation_index WHERE citation_hash = ?', [entry.citation_hash])
    const existingRow = (existing as Record<string, unknown>[])[0]

    if (existingRow) {
      const existingUrls = JSON.parse(existingRow.source_urls as string) as string[]
      const mergedUrls = [...new Set([...existingUrls, ...entry.source_urls])]
      await this.pool.execute(`
        UPDATE citation_index SET
          status = ?,
          confidence = ?,
          source_urls = ?,
          verification_count = verification_count + 1,
          last_seen = ?,
          conflicting_results = ?,
          jurisdiction = COALESCE(?, jurisdiction),
          citation_type = COALESCE(?, citation_type)
        WHERE citation_hash = ?
      `, [
        entry.status, entry.confidence,
        JSON.stringify(mergedUrls),
        entry.last_seen,
        existingRow.status !== entry.status ? 1 : 0,
        entry.jurisdiction ?? null, entry.citation_type ?? null,
        entry.citation_hash,
      ])
    } else {
      await this.pool.execute(`
        INSERT INTO citation_index
        (citation_hash, normalized_text, status, confidence, source_urls,
         verification_count, first_seen, last_seen, conflicting_results,
         jurisdiction, citation_type)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?)
      `, [
        entry.citation_hash, entry.normalized_text, entry.status,
        entry.confidence, JSON.stringify(entry.source_urls),
        entry.first_seen, entry.last_seen,
        entry.jurisdiction ?? null, entry.citation_type ?? null,
      ])
    }
  }

  async getIndexStats(): Promise<{ total: number; verified: number; hallucinated: number; unverifiable: number }> {
    const [totalRows] = await this.pool.execute('SELECT COUNT(*) as total FROM citation_index')
    const total = (totalRows as Record<string, unknown>[])[0].total as number

    const [vRows] = await this.pool.execute("SELECT COUNT(*) as cnt FROM citation_index WHERE status = 'verified'")
    const verified = (vRows as Record<string, unknown>[])[0].cnt as number

    const [hRows] = await this.pool.execute("SELECT COUNT(*) as cnt FROM citation_index WHERE status = 'hallucinated'")
    const hallucinated = (hRows as Record<string, unknown>[])[0].cnt as number

    const [uRows] = await this.pool.execute("SELECT COUNT(*) as cnt FROM citation_index WHERE status = 'unverifiable'")
    const unverifiable = (uRows as Record<string, unknown>[])[0].cnt as number

    return { total, verified, hallucinated, unverifiable }
  }

  async saveMagicToken(token: MagicToken): Promise<void> {
    await this.pool.execute(`
      REPLACE INTO magic_tokens (token_hash, email, expires_at, used)
      VALUES (?, ?, ?, ?)
    `, [token.tokenHash, token.email, token.expiresAt, token.used ? 1 : 0])
  }

  async getMagicToken(token: string, email: string): Promise<MagicToken | null> {
    const { createHash } = await import('node:crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const [rows] = await this.pool.execute('SELECT * FROM magic_tokens WHERE token_hash = ? AND email = ?', [tokenHash, email])
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) return null
    return {
      tokenHash: row.token_hash as string,
      email: row.email as string,
      expiresAt: row.expires_at as string,
      used: row.used === 1,
    }
  }

  async markMagicTokenUsed(token: string): Promise<void> {
    const { createHash } = await import('node:crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await this.pool.execute('UPDATE magic_tokens SET used = 1 WHERE token_hash = ?', [tokenHash])
  }

  async saveApiKey(key: ApiKey): Promise<void> {
    await this.pool.execute(`
      REPLACE INTO api_keys (id, key_prefix, key_hash, label, created_at, last_used_at, revoked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [key.id, key.keyPrefix, key.keyHash, key.label, key.createdAt, key.lastUsedAt ?? null, key.revoked ? 1 : 0])
  }

  async getApiKeyByKeyPrefix(keyPrefix: string): Promise<ApiKey | null> {
    const [rows] = await this.pool.execute('SELECT * FROM api_keys WHERE key_prefix = ?', [keyPrefix])
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) return null
    return rowToApiKey(row)
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    const [rows] = await this.pool.execute('SELECT * FROM api_keys WHERE key_hash = ?', [keyHash])
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) return null
    return rowToApiKey(row)
  }

  async listApiKeys(): Promise<ApiKey[]> {
    const [rows] = await this.pool.execute('SELECT * FROM api_keys ORDER BY created_at DESC')
    return (rows as Record<string, unknown>[]).map(rowToApiKey)
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.pool.execute('UPDATE api_keys SET revoked = 1 WHERE id = ?', [id])
  }

  close(): void {
    void this.pool.end()
  }
}

function rowToApiKey(row: Record<string, unknown>): ApiKey {
  return {
    id: row.id as string,
    keyPrefix: row.key_prefix as string,
    keyHash: row.key_hash as string,
    label: row.label as string,
    createdAt: row.created_at as string,
    lastUsedAt: row.last_used_at as string | null,
    revoked: row.revoked === 1,
  }
}

function rowToDocumentVerification(row: Record<string, unknown>): DocumentVerification {
  return {
    id: row.id as string,
    document_name: row.document_name as string,
    document_hash: row.document_hash as string,
    total_citations: row.total_citations as number,
    verified_count: row.verified_count as number,
    hallucinated_count: row.hallucinated_count as number,
    misattributed_count: row.misattributed_count as number,
    unverifiable_count: row.unverifiable_count as number,
    pending_count: row.pending_count as number,
    overall_score: row.overall_score as number,
    coverage_summary: JSON.parse(row.coverage_summary as string),
    citations: JSON.parse(row.citations as string),
    checked_at: row.checked_at as string,
    duration_ms: row.duration_ms as number,
    scope_notice: row.scope_notice as string,
  }
}

function rowToCitationVerification(row: Record<string, unknown>): CitationVerification {
  return {
    id: row.id as string,
    citation: {
      raw_text: row.raw_text as string,
      normalized_text: row.normalized_text as string,
      type: row.type as CitationVerification['citation']['type'],
      jurisdiction: (row.jurisdiction as string) ?? undefined,
      components: row.components ? JSON.parse(row.components as string) : undefined,
      context: (row.context as string) ?? undefined,
    },
    status: row.status as CitationVerification['status'],
    confidence: row.confidence as number,
    sources_checked: JSON.parse(row.sources_checked as string),
    coverage_note: (row.coverage_note as string) ?? undefined,
    matched_source_text: (row.matched_source_text as string) ?? undefined,
    checked_at: row.checked_at as string,
  }
}

function rowToComplianceReport(row: Record<string, unknown>): ComplianceReport {
  return {
    id: row.id as string,
    document_verification_id: row.document_verification_id as string,
    standard: row.standard as ComplianceReport['standard'],
    jurisdiction: row.jurisdiction as string,
    passed: row.passed === 1,
    score: row.score as number,
    findings: JSON.parse(row.findings as string),
    scope_notice: row.scope_notice as string,
    summary: row.summary as string,
    generated_at: row.generated_at as string,
    expires_at: row.expires_at as string,
  }
}

function rowToIndexEntry(row: Record<string, unknown>): CitationIndexEntry {
  return {
    citation_hash: row.citation_hash as string,
    normalized_text: row.normalized_text as string,
    status: row.status as CitationIndexEntry['status'],
    confidence: row.confidence as number,
    source_urls: JSON.parse(row.source_urls as string),
    verification_count: row.verification_count as number,
    first_seen: row.first_seen as string,
    last_seen: row.last_seen as string,
    conflicting_results: row.conflicting_results === 1,
    jurisdiction: (row.jurisdiction as string) ?? undefined,
    citation_type: (row.citation_type as 'case' | 'statute' | 'regulation' | 'treatise' | 'other') ?? undefined,
  }
}

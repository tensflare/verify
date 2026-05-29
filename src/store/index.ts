import type { DocumentVerification, CitationVerification, ComplianceReport, CitationIndexEntry } from '../schema.js'
import type { MagicToken } from '../auth/magic.js'
import type { ApiKey } from '../auth/keys.js'

export interface Store {
  initialize(): Promise<void>
  saveDocumentVerification(dv: DocumentVerification): Promise<void>
  getDocumentVerification(id: string): Promise<DocumentVerification | null>
  saveCitationVerification(cv: CitationVerification): Promise<void>
  getCitationVerification(id: string): Promise<CitationVerification | null>
  saveComplianceReport(cr: ComplianceReport): Promise<void>
  getComplianceReport(id: string): Promise<ComplianceReport | null>
  getCitationIndexEntry(hash: string): Promise<CitationIndexEntry | null>
  upsertCitationIndexEntry(entry: CitationIndexEntry): Promise<void>
  getIndexStats(): Promise<{ total: number; verified: number; hallucinated: number; unverifiable: number }>
  saveMagicToken(token: MagicToken): Promise<void>
  getMagicToken(token: string, email: string): Promise<MagicToken | null>
  markMagicTokenUsed(token: string): Promise<void>
  saveApiKey(key: ApiKey): Promise<void>
  getApiKeyByKeyPrefix(keyPrefix: string): Promise<ApiKey | null>
  getApiKeyByHash(keyHash: string): Promise<ApiKey | null>
  listApiKeys(): Promise<ApiKey[]>
  revokeApiKey(id: string): Promise<void>
  close(): void
}

import { randomBytes, createHash } from 'node:crypto'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env['LEGALVERIFY_JWT_SECRET'] ?? randomBytes(32).toString('hex')
const MAGIC_TOKEN_EXPIRY_MS = 15 * 60 * 1000
const JWT_EXPIRY = '24h'

export interface MagicToken {
  tokenHash: string
  email: string
  expiresAt: string
  used: boolean
}

export function generateMagicToken(email: string): { token: string; tokenHash: string; expiresAt: string } {
  const token = `lv_magic_${randomBytes(24).toString('hex')}`
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + MAGIC_TOKEN_EXPIRY_MS).toISOString()
  return { token, tokenHash, expiresAt }
}

export function verifyMagicToken(token: string, stored: { tokenHash: string; expiresAt: string; used: boolean }): boolean {
  if (stored.used) return false
  if (new Date(stored.expiresAt) < new Date()) return false
  const hash = createHash('sha256').update(token).digest('hex')
  return hash === stored.tokenHash
}

export function issueJwt(email: string, scope: string = 'user'): string {
  return jwt.sign({ email, scope }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyJwt(token: string): { email: string; scope: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; scope: string }
    return decoded
  } catch {
    return null
  }
}

export function getJwtSecret(): string {
  return JWT_SECRET
}

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'

const KEY_PREFIX = 'lv_'

export interface ApiKey {
  id: string
  keyPrefix: string
  keyHash: string
  label: string
  createdAt: string
  lastUsedAt: string | null
  revoked: boolean
}

export function generateApiKey(label: string): { apiKey: string; keyHash: string; keyPrefix: string; id: string } {
  const raw = randomBytes(28).toString('base64url')
  const apiKey = `${KEY_PREFIX}${raw}`
  const keyHash = createHash('sha256').update(apiKey).digest('hex')
  const keyPrefix = apiKey.slice(0, 8)
  const id = `key_${randomBytes(8).toString('hex')}`
  return { apiKey, keyHash, keyPrefix, id }
}

export function verifyApiKey(apiKey: string, storedHash: string): boolean {
  if (!apiKey.startsWith(KEY_PREFIX)) return false
  const hash = createHash('sha256').update(apiKey).digest('hex')
  if (hash.length !== storedHash.length) return false
  return timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash))
}

export function hashExistingKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

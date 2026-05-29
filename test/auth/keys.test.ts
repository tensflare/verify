import { describe, it, expect } from 'vitest'
import { generateApiKey, verifyApiKey, hashExistingKey } from '../../src/auth/keys.js'

describe('API Keys', () => {
  it('generates a key with correct prefix', () => {
    const result = generateApiKey('test key')
    expect(result.apiKey).toMatch(/^lv_[A-Za-z0-9_-]+$/)
    expect(result.keyPrefix).toBe(result.apiKey.slice(0, 8))
    expect(result.id).toMatch(/^key_[a-f0-9]+$/)
  })

  it('generates unique keys', () => {
    const key1 = generateApiKey('key 1')
    const key2 = generateApiKey('key 2')
    expect(key1.apiKey).not.toBe(key2.apiKey)
    expect(key1.keyHash).not.toBe(key2.keyHash)
  })

  it('verifies a valid key', () => {
    const { apiKey, keyHash } = generateApiKey('test')
    expect(verifyApiKey(apiKey, keyHash)).toBe(true)
  })

  it('rejects an invalid key', () => {
    const { keyHash } = generateApiKey('test')
    expect(verifyApiKey('lv_wrongkey', keyHash)).toBe(false)
  })

  it('rejects a key without prefix', () => {
    const { keyHash } = generateApiKey('test')
    expect(verifyApiKey('no-prefix-key', keyHash)).toBe(false)
  })

  it('rejects wrong hash', () => {
    const { apiKey } = generateApiKey('test')
    expect(verifyApiKey(apiKey, '0000000000000000000000000000000000000000000000000000000000000000')).toBe(false)
  })

  it('hashExistingKey produces same hash', () => {
    const { apiKey, keyHash } = generateApiKey('test')
    const rehashed = hashExistingKey(apiKey)
    expect(rehashed).toBe(keyHash)
  })
})

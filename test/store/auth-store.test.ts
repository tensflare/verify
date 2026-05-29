import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { v4 as uuidv4 } from 'uuid'
import { SqliteStore } from '../../src/store/sqlite.js'
import { generateApiKey } from '../../src/auth/keys.js'
import { generateMagicToken } from '../../src/auth/magic.js'

const TEST_DB = join(tmpdir(), `legalverify-auth-test-${uuidv4()}.db`)

describe('SqliteStore Auth', () => {
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

  describe('magic tokens', () => {
    it('saves and retrieves a magic token', async () => {
      const { token, tokenHash, expiresAt } = generateMagicToken('user@example.com')
      await store.saveMagicToken({ tokenHash, email: 'user@example.com', expiresAt, used: false })
      const retrieved = await store.getMagicToken(token, 'user@example.com')
      expect(retrieved).not.toBeNull()
      expect(retrieved!.email).toBe('user@example.com')
      expect(retrieved!.used).toBe(false)
    })

    it('returns null for non-existent token', async () => {
      const result = await store.getMagicToken('nonexistent', 'test@example.com')
      expect(result).toBeNull()
    })

    it('returns null for wrong email', async () => {
      const { token, tokenHash, expiresAt } = generateMagicToken('user@example.com')
      await store.saveMagicToken({ tokenHash, email: 'user@example.com', expiresAt, used: false })
      const result = await store.getMagicToken(token, 'wrong@example.com')
      expect(result).toBeNull()
    })

    it('marks token as used', async () => {
      const { token, tokenHash, expiresAt } = generateMagicToken('user@example.com')
      await store.saveMagicToken({ tokenHash, email: 'user@example.com', expiresAt, used: false })
      await store.markMagicTokenUsed(token)
      const retrieved = await store.getMagicToken(token, 'user@example.com')
      expect(retrieved!.used).toBe(true)
    })
  })

  describe('api keys', () => {
    it('saves and retrieves an API key', async () => {
      const { id, keyPrefix, keyHash } = generateApiKey('test key')
      await store.saveApiKey({ id, keyPrefix, keyHash, label: 'test key', createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false })
      const byPrefix = await store.getApiKeyByKeyPrefix(keyPrefix)
      expect(byPrefix).not.toBeNull()
      expect(byPrefix!.label).toBe('test key')
      const byHash = await store.getApiKeyByHash(keyHash)
      expect(byHash).not.toBeNull()
      expect(byHash!.id).toBe(id)
    })

    it('lists all API keys', async () => {
      await store.saveApiKey({ id: 'key1', keyPrefix: 'lv_test1', keyHash: 'hash1', label: 'key 1', createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false })
      await store.saveApiKey({ id: 'key2', keyPrefix: 'lv_test2', keyHash: 'hash2', label: 'key 2', createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false })
      const keys = await store.listApiKeys()
      expect(keys.length).toBe(2)
    })

    it('revokes an API key', async () => {
      const { id, keyPrefix, keyHash } = generateApiKey('revocable')
      await store.saveApiKey({ id, keyPrefix, keyHash, label: 'revocable', createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false })
      await store.revokeApiKey(id)
      const retrieved = await store.getApiKeyByKeyPrefix(keyPrefix)
      expect(retrieved!.revoked).toBe(true)
    })
  })
})

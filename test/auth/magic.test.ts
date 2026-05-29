import { describe, it, expect } from 'vitest'
import { generateMagicToken, verifyMagicToken, issueJwt, verifyJwt } from '../../src/auth/magic.js'

describe('Magic Link Auth', () => {
  it('generates a magic token', () => {
    const result = generateMagicToken('test@example.com')
    expect(result.token).toMatch(/^lv_magic_[a-f0-9]+$/)
    expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.expiresAt).toBeTruthy()
  })

  it('expiresAt is about 15 minutes in the future', () => {
    const result = generateMagicToken('test@example.com')
    const expires = new Date(result.expiresAt).getTime()
    const now = Date.now()
    const diff = expires - now
    expect(diff).toBeGreaterThan(14 * 60 * 1000)
    expect(diff).toBeLessThan(16 * 60 * 1000)
  })

  it('verifies a valid token', () => {
    const { token, tokenHash, expiresAt } = generateMagicToken('test@example.com')
    const valid = verifyMagicToken(token, { tokenHash, expiresAt, used: false })
    expect(valid).toBe(true)
  })

  it('rejects an expired token', () => {
    const { token, tokenHash } = generateMagicToken('test@example.com')
    const expiresAt = new Date(Date.now() - 1000).toISOString()
    const valid = verifyMagicToken(token, { tokenHash, expiresAt, used: false })
    expect(valid).toBe(false)
  })

  it('rejects a used token', () => {
    const { token, tokenHash, expiresAt } = generateMagicToken('test@example.com')
    const valid = verifyMagicToken(token, { tokenHash, expiresAt, used: true })
    expect(valid).toBe(false)
  })

  it('rejects a wrong token', () => {
    const { tokenHash, expiresAt } = generateMagicToken('test@example.com')
    const valid = verifyMagicToken('wrong-token', { tokenHash, expiresAt, used: false })
    expect(valid).toBe(false)
  })
})

describe('JWT Auth', () => {
  it('issues a JWT', () => {
    const token = issueJwt('test@example.com')
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it('verifies a valid JWT', () => {
    const token = issueJwt('test@example.com')
    const decoded = verifyJwt(token)
    expect(decoded).not.toBeNull()
    expect(decoded!.email).toBe('test@example.com')
    expect(decoded!.scope).toBe('user')
  })

  it('rejects an invalid JWT', () => {
    const decoded = verifyJwt('invalid.jwt.token')
    expect(decoded).toBeNull()
  })

  it('rejects a tampered JWT', () => {
    const token = issueJwt('test@example.com')
    const parts = token.split('.')
    parts[2] = 'tampered'
    const decoded = verifyJwt(parts.join('.'))
    expect(decoded).toBeNull()
  })
})

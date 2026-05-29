import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { authMiddleware, optionalAuth } from '../../src/auth/middleware.js'

function mockReq(authHeader?: string): Partial<Request> {
  return {
    headers: { authorization: authHeader } as Record<string, string | undefined>,
  }
}

function mockRes(): Partial<Response> {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('authMiddleware', () => {
  it('returns 401 without authorization header', () => {
    const req = mockReq()
    const res = mockRes()
    authMiddleware()(req as Request, res as Response, vi.fn())
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Authorization header required' })
  })

  it('returns 401 with malformed header', () => {
    const req = mockReq('invalidformat')
    const res = mockRes()
    authMiddleware()(req as Request, res as Response, vi.fn())
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid authorization header format' })
  })

  it('returns 401 with invalid JWT', () => {
    const req = mockReq('Bearer invalid.jwt.token')
    const res = mockRes()
    authMiddleware()(req as Request, res as Response, vi.fn())
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('uses custom verify function if provided', () => {
    const req = mockReq('Custom token123')
    const res = mockRes()
    const customVerify = (token: string) => {
      if (token === 'token123') return { email: 'test@example.com', scope: 'user', method: 'api_key' as const }
      return null
    }
    const next = vi.fn()
    authMiddleware(customVerify)(req as Request, res as Response, next)
    expect(next).toHaveBeenCalled()
    expect((req as Request).user).toBeDefined()
    expect((req as Request).user!.email).toBe('test@example.com')
  })
})

describe('optionalAuth', () => {
  it('passes through without auth header', () => {
    const req = mockReq()
    const next = vi.fn()
    optionalAuth(req as Request, {} as Response, next)
    expect(next).toHaveBeenCalled()
    expect((req as Request).user).toBeUndefined()
  })

  it('decodes JWT if present', async () => {
    const { issueJwt } = await import('../../src/auth/magic.js')
    const token = issueJwt('test@example.com')
    const req = mockReq(`Bearer ${token}`)
    const next = vi.fn()
    optionalAuth(req as Request, {} as Response, next)
    expect(next).toHaveBeenCalled()
    expect((req as Request).user).toBeDefined()
    expect((req as Request).user!.email).toBe('test@example.com')
  })

  it('passes through even with invalid JWT', () => {
    const req = mockReq('Bearer invalid.jwt.token')
    const next = vi.fn()
    optionalAuth(req as Request, {} as Response, next)
    expect(next).toHaveBeenCalled()
    expect((req as Request).user).toBeUndefined()
  })
})

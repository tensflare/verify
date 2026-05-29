import { Router } from 'express'
import type { SqliteStore } from '../store/sqlite.js'
import { generateMagicToken, verifyMagicToken, issueJwt } from './magic.js'
import { generateApiKey, verifyApiKey } from './keys.js'
import { authMiddleware } from './middleware.js'

export function createAuthRoutes(store: SqliteStore): Router {
  const router = Router()

  router.post('/auth/magic/request', async (req, res) => {
    try {
      const { email } = req.body
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'email field is required' })
        return
      }

      const { token, tokenHash, expiresAt } = generateMagicToken(email)
      await store.saveMagicToken({ tokenHash, email, expiresAt, used: false })

      // In production, send email. For dev, return token directly.
      const origin = req.headers['origin'] ?? 'http://localhost:3579'
      const magicLink = `${origin}/auth/magic/verify?token=${token}&email=${encodeURIComponent(email)}`

      res.json({
        sent: true,
        email,
        // Dev-only: remove in production
        ...(process.env['NODE_ENV'] !== 'production' ? { magicLink, token } : {}),
      })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate token' })
    }
  })

  router.post('/auth/magic/verify', async (req, res) => {
    try {
      const { token, email } = req.body
      if (!token || !email) {
        res.status(400).json({ error: 'token and email are required' })
        return
      }

      const stored = await store.getMagicToken(token, email)
      if (!stored) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      if (!verifyMagicToken(token, stored)) {
        res.status(401).json({ error: 'Token expired or already used' })
        return
      }

      await store.markMagicTokenUsed(token)
      const jwt = issueJwt(email)

      res.json({ token: jwt, email })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to verify token' })
    }
  })

  router.get('/auth/google', (req, res) => {
    const clientId = process.env['LEGALVERIFY_GOOGLE_CLIENT_ID']
    if (!clientId) {
      res.status(503).json({ error: 'Google OAuth not configured' })
      return
    }
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile`
    res.redirect(url)
  })

  router.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query
    if (!code) {
      res.status(400).json({ error: 'Authorization code required' })
      return
    }

    const clientId = process.env['LEGALVERIFY_GOOGLE_CLIENT_ID']
    const clientSecret = process.env['LEGALVERIFY_GOOGLE_CLIENT_SECRET']
    if (!clientId || !clientSecret) {
      res.status(503).json({ error: 'Google OAuth not configured' })
      return
    }

    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenRes.ok) {
        res.status(401).json({ error: 'Failed to exchange authorization code' })
        return
      }

      const tokenData = await tokenRes.json() as { access_token: string }
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })

      if (!userRes.ok) {
        res.status(401).json({ error: 'Failed to fetch user info' })
        return
      }

      const userData = await userRes.json() as { email: string; name?: string }
      const jwt = issueJwt(userData.email)

      res.json({ token: jwt, email: userData.email, name: userData.name })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Google OAuth failed' })
    }
  })

  // API key management (requires auth)
  router.post('/auth/keys', authMiddleware(), async (req, res) => {
    try {
      const { label } = req.body
      if (!label || typeof label !== 'string') {
        res.status(400).json({ error: 'label is required' })
        return
      }

      const { apiKey, keyHash, keyPrefix, id } = generateApiKey(label)
      await store.saveApiKey({ id, keyPrefix, keyHash, label, createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false })

      res.status(201).json({ id, label, keyPrefix, apiKey })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate key' })
    }
  })

  router.get('/auth/keys', authMiddleware(), async (req, res) => {
    try {
      const keys = await store.listApiKeys()
      res.json(keys.map(k => ({ id: k.id, keyPrefix: k.keyPrefix, label: k.label, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, revoked: k.revoked })))
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list keys' })
    }
  })

  router.delete('/auth/keys/:id', authMiddleware(), async (req, res) => {
    try {
      await store.revokeApiKey(req.params.id)
      res.json({ revoked: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to revoke key' })
    }
  })

  return router
}

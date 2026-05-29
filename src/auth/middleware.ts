import type { Request, Response, NextFunction } from 'express'
import { verifyJwt } from './magic.js'
import { verifyApiKey } from './keys.js'

export interface AuthUser {
  email: string
  scope: string
  method: 'jwt' | 'api_key'
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authMiddleware(verifyFn?: (token: string) => AuthUser | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization']
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' })
      return
    }

    const [scheme, token] = authHeader.split(' ')
    if (!scheme || !token) {
      res.status(401).json({ error: 'Invalid authorization header format' })
      return
    }

    if (verifyFn) {
      const user = verifyFn(token)
      if (user) {
        req.user = user
        next()
        return
      }
    }

    if (scheme.toLowerCase() === 'bearer') {
      const jwtUser = verifyJwt(token)
      if (jwtUser) {
        req.user = { ...jwtUser, method: 'jwt' }
        next()
        return
      }
    }

    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    next()
    return
  }

  const [scheme, token] = authHeader.split(' ')
  if (!scheme || !token) {
    next()
    return
  }

  if (scheme.toLowerCase() === 'bearer') {
    const jwtUser = verifyJwt(token)
    if (jwtUser) {
      req.user = { ...jwtUser, method: 'jwt' }
    }
  }

  next()
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { CitationVerifier, generateComplianceReport, formatCoverageMap } from '../../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createTestApp() {
  const app = express()
  const verifier = new CitationVerifier()

  const publicPath = resolve(__dirname, '..', '..', 'src', 'web', 'public')
  app.use(express.static(publicPath))

  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.2.0' })
  })

  app.get('/coverage', (_req, res) => {
    res.type('text/plain').send(formatCoverageMap())
  })

  app.post('/verify', async (req, res) => {
    try {
      const { text, documentName } = req.body
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text field is required' })
        return
      }
      const result = await verifier.verifyText(text, { documentName })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Verification failed' })
    }
  })

  app.post('/compliance', async (req, res) => {
    try {
      const { verification, standard, jurisdiction } = req.body
      if (!verification) {
        res.status(400).json({ error: 'verification field is required' })
        return
      }
      const report = await generateComplianceReport(verification, { standard, jurisdiction })
      res.json(report)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Compliance check failed' })
    }
  })

  app.post('/verify-and-comply', async (req, res) => {
    try {
      const { text, documentName, standard, jurisdiction } = req.body
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text field is required' })
        return
      }
      const verification = await verifier.verifyText(text, { documentName })
      const compliance = await generateComplianceReport(verification, { standard, jurisdiction })
      res.json({ verification, compliance })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Verification failed' })
    }
  })

  return app
}

type TestServer = { port: number; close: () => void }

function makeServer(app: express.Express): Promise<TestServer> {
  return new Promise((resolve) => {
    const server = createServer(app)
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ port, close: () => server.close() })
    })
  })
}

async function request(server: TestServer, method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }
  const res = await fetch(`http://localhost:${server.port}${path}`, opts)
  const data = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : await res.text()
  return { status: res.status, data }
}

describe('API Server', () => {
  let server: TestServer

  beforeAll(async () => {
    const app = createTestApp()
    server = await makeServer(app)
  })

  it('GET /health returns ok', async () => {
    const { status, data } = await request(server, 'GET', '/health')
    expect(status).toBe(200)
    expect(data).toMatchObject({ status: 'ok', version: '0.2.0' })
  })

  it('GET /coverage returns coverage map', async () => {
    const { status, data } = await request(server, 'GET', '/coverage')
    expect(status).toBe(200)
    expect(data as string).toContain('LegalVerify')
  })

  it('POST /verify verifies text', { timeout: 15000 }, async () => {
    const { status, data } = await request(server, 'POST', '/verify', { text: 'See Roe v. Wade, 410 U.S. 113' })
    expect(status).toBe(200)
    const d = data as Record<string, unknown>
    expect(d).toHaveProperty('total_citations')
    expect(d).toHaveProperty('citations')
    expect(d).toHaveProperty('scope_notice')
  })

  it('POST /verify returns 400 for missing text', async () => {
    const { status, data } = await request(server, 'POST', '/verify', {})
    expect(status).toBe(400)
    expect(data).toMatchObject({ error: 'text field is required' })
  })

  it('POST /verify accepts documentName', async () => {
    const { status, data } = await request(server, 'POST', '/verify', { text: 'hello', documentName: 'mydoc' })
    expect(status).toBe(200)
    expect(data).toMatchObject({ document_name: 'mydoc' })
  })

  it('POST /compliance generates compliance report', async () => {
    const res = await request(server, 'POST', '/verify', { text: 'hello' })
    const { status, data } = await request(server, 'POST', '/compliance', { verification: res.data })
    expect(status).toBe(200)
    expect(data).toHaveProperty('passed')
    expect(data).toHaveProperty('standard')
    expect(data).toHaveProperty('findings')
  })

  it('POST /compliance returns 400 for missing verification', async () => {
    const { status, data } = await request(server, 'POST', '/compliance', {})
    expect(status).toBe(400)
    expect(data).toMatchObject({ error: 'verification field is required' })
  })

  it('POST /verify-and-comply returns both', { timeout: 15000 }, async () => {
    const { status, data } = await request(server, 'POST', '/verify-and-comply', { text: 'See 410 U.S. 113' })
    expect(status).toBe(200)
    const d = data as Record<string, unknown>
    expect(d).toHaveProperty('verification')
    expect(d).toHaveProperty('compliance')
  })

  it('POST /verify-and-comply returns 400 for missing text', async () => {
    const { status, data } = await request(server, 'POST', '/verify-and-comply', {})
    expect(status).toBe(400)
    expect(data).toMatchObject({ error: 'text field is required' })
  })

  it('serves index.html for GET /', async () => {
    const { status } = await request(server, 'GET', '/')
    expect(status).toBe(200)
  })

  afterAll(() => {
    if (server) server.close()
  })
})

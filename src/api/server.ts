import { createHash } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CitationVerifier } from '../index.js'
import { generateComplianceReport } from '../compliance/rules.js'
import { formatCoverageMap } from '../verify/coverage.js'
import { generateVerificationPdf } from '../report/pdf.js'
import { SqliteStore } from '../store/sqlite.js'
import { createAuthRoutes } from '../auth/routes.js'
import { optionalAuth } from '../auth/middleware.js'

interface ServerOptions {
  port?: number
  host?: string
  dbPath?: string
}

export async function startServer(opts: ServerOptions = {}): Promise<void> {
  const port = opts.port ?? 3579
  const host = opts.host ?? 'localhost'
  const dbPath = opts.dbPath ?? process.env['LEGALVERIFY_DB_PATH'] ?? './legalverify.db'

  const app = express()
  const verifier = new CitationVerifier()
  const store = new SqliteStore(dbPath)
  await store.initialize()

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Serve web UI
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const publicPath = resolve(__dirname, '..', 'web', 'public')
  app.use(express.static(publicPath))

  // Auth routes
  app.use(createAuthRoutes(store))

  // Health
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.2.0', scope: 'citation-existence-only' })
  })

  // Coverage map
  app.get('/coverage', (_req, res) => {
    const text = formatCoverageMap()
    res.type('text/plain').send(text)
  })

  // Verify citations in text (anonymous)
  app.post('/verify', optionalAuth, async (req, res) => {
    try {
      const { text, documentName } = req.body
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text field is required' })
        return
      }

      const result = await verifier.verifyText(text, { documentName })

      // Save to citation index if authenticated
      if (req.user) {
        for (const cv of result.citations) {
          await store.upsertCitationIndexEntry({
            citation_hash: createHash('sha256').update(cv.citation.normalized_text).digest('hex'),
            normalized_text: cv.citation.normalized_text,
            status: cv.status,
            confidence: cv.confidence,
            source_urls: cv.sources_checked.filter(s => s.url).map(s => s.url!),
            verification_count: 1,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            conflicting_results: false,
            jurisdiction: cv.citation.jurisdiction ?? 'US',
            citation_type: cv.citation.type,
          })
        }
      }

      res.json(result)
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Verification failed',
      })
    }
  })

  // Compliance report
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
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Compliance check failed',
      })
    }
  })

  // Citation index stats
  app.get('/stats', async (_req, res) => {
    try {
      const stats = await store.getIndexStats()
      res.json(stats)
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to get stats',
      })
    }
  })

  // Verify + compliance in one call
  app.post('/verify-and-comply', optionalAuth, async (req, res) => {
    try {
      const { text, documentName, standard, jurisdiction } = req.body
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text field is required' })
        return
      }

      const verification = await verifier.verifyText(text, { documentName })
      const compliance = await generateComplianceReport(verification, { standard, jurisdiction })

      // Save to citation index if authenticated
      if (req.user) {
        for (const cv of verification.citations) {
          await store.upsertCitationIndexEntry({
            citation_hash: createHash('sha256').update(cv.citation.normalized_text).digest('hex'),
            normalized_text: cv.citation.normalized_text,
            status: cv.status,
            confidence: cv.confidence,
            source_urls: cv.sources_checked.filter(s => s.url).map(s => s.url!),
            verification_count: 1,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            conflicting_results: false,
            jurisdiction: cv.citation.jurisdiction ?? 'US',
            citation_type: cv.citation.type,
          })
        }
      }

      res.json({ verification, compliance })
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Verification failed',
      })
    }
  })

  // Generate PDF report
  app.post('/report/pdf', async (req, res) => {
    try {
      const { verification, compliance } = req.body
      if (!verification) {
        res.status(400).json({ error: 'verification field is required' })
        return
      }

      const pdf = generateVerificationPdf(verification, compliance ?? undefined)
      const filename = `legalverify-${verification.document_name ?? 'report'}-${Date.now()}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(pdf)
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'PDF generation failed',
      })
    }
  })

  app.listen(port, host, () => {
    console.log(`LegalVerify server listening on http://${host}:${port}`)
  })
}

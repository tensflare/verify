#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'node:fs'
import { CitationVerifier } from './index.js'
import { formatCoverageMap } from './verify/coverage.js'
import { formatScopeNotice } from './verify/scope.js'
import { generateComplianceReport } from './compliance/rules.js'
import { generateVerificationPdf } from './report/pdf.js'
import { SqliteStore } from './store/sqlite.js'

const program = new Command()

program
  .name('legalverify')
  .alias('lv')
  .version('0.2.0')
  .description('Citation verification for the AI era — check whether legal citations exist and are still good law')

program.command('verify')
  .description('Verify citations in a document')
  .argument('[file]', 'Path to document file (reads stdin if omitted)')
  .option('-n, --name <name>', 'Document name for the report')
  .option('-o, --output <path>', 'Write JSON report to file')
  .option('--json', 'Output raw JSON')
  .option('--brief', 'Suppress scope notice')
  .action(async (file, opts) => {
    const text = file
      ? readFileSync(file, 'utf-8')
      : readStdin()

    const verifier = new CitationVerifier()
    const result = await verifier.verifyText(text, { documentName: opts.name })

    if (opts.json || opts.output) {
      const json = JSON.stringify(result, null, 2)
      if (opts.output) {
        writeFileSync(opts.output, json, 'utf-8')
        console.log(`Report written to ${opts.output}`)
      } else {
        console.log(json)
      }
      return
    }

    if (!opts.brief) {
      console.log(formatScopeNotice())
      console.log()
    }
    console.log(`Document: ${result.document_name}`)
    console.log(`Citations: ${result.total_citations} total`)
    console.log(`  Verified:      ${result.verified_count}`)
    console.log(`  Hallucinated:  ${result.hallucinated_count}`)
    console.log(`  Misattributed: ${result.misattributed_count}`)
    console.log(`  Unverifiable:  ${result.unverifiable_count}`)
    console.log(`  Pending:       ${result.pending_count}`)
    console.log(`Coverage: ${result.coverage_summary.covered} covered, ${result.coverage_summary.partial} partial, ${result.coverage_summary.uncovered} uncovered`)
    console.log(`Confidence: ${(result.overall_score * 100).toFixed(0)}%`)
    console.log(`Duration: ${result.duration_ms}ms`)
  })

program.command('compliance')
  .description('Generate a compliance report from a verification result')
  .argument('[file]', 'Path to JSON verification report (stdin if omitted)')
  .option('-s, --standard <standard>', 'Compliance standard', 'ny-part-161')
  .option('-j, --jurisdiction <jurisdiction>', 'Override jurisdiction')
  .option('-o, --output <path>', 'Write JSON report to file')
  .action(async (file, opts) => {
    const input = file
      ? readFileSync(file, 'utf-8')
      : readStdin()

    const docVerification = JSON.parse(input)
    const report = await generateComplianceReport(docVerification, {
      standard: opts.standard,
      jurisdiction: opts.jurisdiction,
    })

    if (opts.output) {
      writeFileSync(opts.output, JSON.stringify(report, null, 2), 'utf-8')
      console.log(`Compliance report written to ${opts.output}`)
    } else {
      console.log(JSON.stringify(report, null, 2))
    }
  })

program.command('report')
  .description('Generate a PDF report from a verification JSON')
  .argument('[file]', 'Path to JSON verification file (stdin if omitted)')
  .option('-o, --output <path>', 'Output PDF path', 'legalverify-report.pdf')
  .option('-c, --compliance <file>', 'Optional compliance JSON file to include')
  .action(async (file, opts) => {
    const input = file ? readFileSync(file, 'utf-8') : readStdin()
    const verification = JSON.parse(input)
    let compliance
    if (opts.compliance) {
      const cInput = readFileSync(opts.compliance, 'utf-8')
      compliance = JSON.parse(cInput)
    }
    const pdf = generateVerificationPdf(verification, compliance)
    writeFileSync(opts.output, pdf)
    console.log(`PDF report written to ${opts.output}`)
  })

program.command('coverage')
  .description('Show source coverage map')
  .action(() => {
    console.log(formatCoverageMap())
  })

program.command('serve')
  .description('Start the LegalVerify API server')
  .option('-p, --port <port>', 'Port to listen on', '3579')
  .option('-d, --db <path>', 'Path to SQLite database')
  .option('--host <host>', 'Host to bind to', 'localhost')
  .action(async (opts) => {
    const { startServer } = await import('./api/server.js')
    await startServer({
      port: parseInt(opts.port),
      dbPath: opts.db ?? process.env['LEGALVERIFY_DB_PATH'] ?? './legalverify.db',
      host: opts.host,
    })
  })

program.command('mcp')
  .description('Start the MCP protocol server (stdio)')
  .action(async () => {
    const { startMcpServer } = await import('./mcp/server.js')
    startMcpServer()
  })

function readStdin(): string {
  return readFileSync(process.stdin.fd, 'utf-8')
}

program.parse()

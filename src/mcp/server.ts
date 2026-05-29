import { readFileSync } from 'node:fs'
import { CitationVerifier } from '../index.js'
import { generateComplianceReport } from '../compliance/rules.js'
import { formatCoverageMap } from '../verify/coverage.js'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required: string[]
  }
}

const TOOLS: McpTool[] = [
  {
    name: 'verify_citations',
    description: 'Verify legal citations in text — checks whether cited cases, statutes, and regulations exist in authoritative sources',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Legal text containing citations to verify' },
        documentName: { type: 'string', description: 'Optional document name for the report' },
      },
      required: ['text'],
    },
  },
  {
    name: 'check_compliance',
    description: 'Generate a compliance report (NY Part 161, generic) from a verification result',
    inputSchema: {
      type: 'object',
      properties: {
        verification: { type: 'object', description: 'DocumentVerification JSON object from verify_citations' },
        standard: { type: 'string', description: 'Compliance standard (ny-part-161, generic)' },
      },
      required: ['verification'],
    },
  },
  {
    name: 'get_coverage',
    description: 'Show which sources and jurisdictions are covered for citation verification',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

function sendResponse(res: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(res) + '\n')
}

async function handleRequest(req: JsonRpcRequest): Promise<void> {
  const verifier = new CitationVerifier()

  switch (req.method) {
    case 'list_tools':
      sendResponse({
        jsonrpc: '2.0',
        id: req.id,
        result: { tools: TOOLS },
      })
      break

    case 'call_tool':
      await handleToolCall(req)
      break

    case 'ping':
      sendResponse({
        jsonrpc: '2.0',
        id: req.id,
        result: { status: 'ok', version: '0.2.0' },
      })
      break

    default:
      sendResponse({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32601, message: `Method not found: ${req.method}` },
      })
  }
}

async function handleToolCall(req: JsonRpcRequest): Promise<void> {
  const name = req.params?.name as string | undefined
  const args = req.params?.arguments as Record<string, unknown> | undefined

  if (!name) {
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32602, message: 'Missing tool name' },
    })
    return
  }

  try {
    switch (name) {
      case 'verify_citations': {
        const text = args?.text as string | undefined
        if (!text) {
          sendResponse({ jsonrpc: '2.0', id: req.id, error: { code: -32602, message: 'text is required' } })
          return
        }
        const verifier = new CitationVerifier()
        const result = await verifier.verifyText(text, { documentName: args?.documentName as string | undefined })
        sendResponse({
          jsonrpc: '2.0',
          id: req.id,
          result: { content: [{ type: 'json', data: result }] },
        })
        break
      }

      case 'check_compliance': {
        const verification = args?.verification as Record<string, unknown> | undefined
        if (!verification) {
          sendResponse({ jsonrpc: '2.0', id: req.id, error: { code: -32602, message: 'verification is required' } })
          return
        }
        const report = await generateComplianceReport(verification as Parameters<typeof generateComplianceReport>[0], {
          standard: (args?.standard as string | undefined) as 'ny-part-161' | 'generic' | undefined,
        })
        sendResponse({
          jsonrpc: '2.0',
          id: req.id,
          result: { content: [{ type: 'json', data: report }] },
        })
        break
      }

      case 'get_coverage': {
        sendResponse({
          jsonrpc: '2.0',
          id: req.id,
          result: { content: [{ type: 'text', data: formatCoverageMap() }] },
        })
        break
      }

      default:
        sendResponse({
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32602, message: `Unknown tool: ${name}` },
        })
    }
  } catch (err) {
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32603, message: err instanceof Error ? err.message : 'Internal error' },
    })
  }
}

function startMcpServer(): void {
  let buffer = ''

  process.stdin.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()

    let newlineIdx: number
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim()
      buffer = buffer.slice(newlineIdx + 1)

      if (!line) continue

      try {
        const request = JSON.parse(line) as JsonRpcRequest
        handleRequest(request).catch(err => {
          sendResponse({
            jsonrpc: '2.0',
            id: request.id ?? null,
            error: { code: -32603, message: err instanceof Error ? err.message : 'Internal error' },
          })
        })
      } catch (err) {
        sendResponse({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        })
      }
    }
  })

  process.stdin.on('end', () => process.exit(0))

  // Send capabilities on startup
  sendResponse({
    jsonrpc: '2.0',
    id: null,
    result: {
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'legalverify-mcp',
        version: '0.2.0',
      },
    },
  })
}

export { startMcpServer, TOOLS }

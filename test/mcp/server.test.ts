import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startMcpServer, TOOLS } from '../../src/mcp/server.js'

describe('MCP Server', () => {
  it('exports TOOLS with verify_citations, check_compliance, get_coverage', () => {
    const toolNames = TOOLS.map(t => t.name)
    expect(toolNames).toContain('verify_citations')
    expect(toolNames).toContain('check_compliance')
    expect(toolNames).toContain('get_coverage')
  })

  it('verify_citations has required text field', () => {
    const tool = TOOLS.find(t => t.name === 'verify_citations')!
    expect(tool.inputSchema.required).toContain('text')
    expect(tool.inputSchema.properties.text.type).toBe('string')
  })

  it('check_compliance has required verification field', () => {
    const tool = TOOLS.find(t => t.name === 'check_compliance')!
    expect(tool.inputSchema.required).toContain('verification')
  })

  it('get_coverage has no required fields', () => {
    const tool = TOOLS.find(t => t.name === 'get_coverage')!
    expect(tool.inputSchema.required).toHaveLength(0)
  })
})

describe('MCP JSON-RPC over stdio', () => {
  let originalStdin: typeof process.stdin
  let originalStdout: typeof process.stdout
  let stdinData: (data: string) => void
  let stdoutData: string[]
  let mockStdin: any
  let mockStdout: any

  beforeEach(() => {
    originalStdin = process.stdin
    originalStdout = process.stdout

    stdoutData = []
    mockStdout = { write: (s: string) => { stdoutData.push(s) } }
    mockStdin = { on: vi.fn(), fd: 0 }

    vi.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any)
    vi.spyOn(process, 'stdout', 'get').mockReturnValue(mockStdout as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends capabilities on startup', () => {
    startMcpServer()
    expect(stdoutData.length).toBeGreaterThan(0)
    const first = JSON.parse(stdoutData[0])
    expect(first.result.capabilities).toBeDefined()
    expect(first.result.serverInfo.name).toBe('legalverify-mcp')
  })

  it('responds to ping', () => {
    startMcpServer()
    stdoutData.length = 0 // clear startup

    // Simulate stdin data
    const onData = mockStdin.on.mock.calls.find((c: [string, Function]) => c[0] === 'data')
    expect(onData).toBeDefined()
    onData[1](JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) + '\n')

    const responses = stdoutData.filter(s => s.length > 0).map(s => JSON.parse(s))
    const pingResponse = responses.find(r => r.id === 1)
    expect(pingResponse).toBeDefined()
    expect(pingResponse.result.status).toBe('ok')
  })

  it('responds to list_tools', () => {
    startMcpServer()
    stdoutData.length = 0

    const onData = mockStdin.on.mock.calls.find((c: [string, Function]) => c[0] === 'data')
    onData[1](JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'list_tools' }) + '\n')

    const responses = stdoutData.filter(s => s.length > 0).map(s => JSON.parse(s))
    const listResponse = responses.find(r => r.id === 1)
    expect(listResponse).toBeDefined()
    expect(listResponse.result.tools.length).toBe(3)
  })

  it('responds with error for unknown method', () => {
    startMcpServer()
    stdoutData.length = 0

    const onData = mockStdin.on.mock.calls.find((c: [string, Function]) => c[0] === 'data')
    onData[1](JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'unknown_method' }) + '\n')

    const responses = stdoutData.filter(s => s.length > 0).map(s => JSON.parse(s))
    const errorResponse = responses.find(r => r.id === 1)
    expect(errorResponse).toBeDefined()
    expect(errorResponse.error.code).toBe(-32601)
  })

  it('responds with parse error for invalid JSON', () => {
    startMcpServer()
    stdoutData.length = 0

    const onData = mockStdin.on.mock.calls.find((c: [string, Function]) => c[0] === 'data')
    onData[1]('not valid json\n')

    const responses = stdoutData.filter(s => s.length > 0).map(s => JSON.parse(s))
    const errorResponse = responses.find(r => r.error && r.error.code === -32700)
    expect(errorResponse).toBeDefined()
  })

  it('handles call_tool without name', () => {
    startMcpServer()
    stdoutData.length = 0

    const onData = mockStdin.on.mock.calls.find((c: [string, Function]) => c[0] === 'data')
    onData[1](JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'call_tool', params: {} }) + '\n')

    const responses = stdoutData.filter(s => s.length > 0).map(s => JSON.parse(s))
    const errorResponse = responses.find(r => r.id === 1)
    expect(errorResponse).toBeDefined()
    expect(errorResponse.error.code).toBe(-32602)
  })

  it('handles call_tool for get_coverage', () => {
    startMcpServer()
    stdoutData.length = 0

    const onData = mockStdin.on.mock.calls.find((c: [string, Function]) => c[0] === 'data')
    onData[1](JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'call_tool',
      params: { name: 'get_coverage', arguments: {} },
    }) + '\n')

    const responses = stdoutData.filter(s => s.length > 0).map(s => JSON.parse(s))
    const coverageResponse = responses.find(r => r.id === 1)
    expect(coverageResponse).toBeDefined()
    expect(coverageResponse.result.content[0].data).toContain('LegalVerify')
  })

  it('handles call_tool for unknown tool', () => {
    startMcpServer()
    stdoutData.length = 0

    const onData = mockStdin.on.mock.calls.find((c: [string, Function]) => c[0] === 'data')
    onData[1](JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'call_tool',
      params: { name: 'nonexistent_tool', arguments: {} },
    }) + '\n')

    const responses = stdoutData.filter(s => s.length > 0).map(s => JSON.parse(s))
    const errorResponse = responses.find(r => r.id === 1)
    expect(errorResponse).toBeDefined()
    expect(errorResponse.error.code).toBe(-32602)
  })
})

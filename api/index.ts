import { createApp } from '../src/api/server.js'
import { SqliteStore } from '../src/store/sqlite.js'
import type { Store } from '../src/store/index.js'

let app: ReturnType<typeof createApp> | null = null
let initPromise: Promise<void> | null = null

async function init(): Promise<void> {
  if (app) return

  let store: Store
  if (process.env['TIDB_HOST']) {
    const { TiDBStore } = await import('../src/store/tidb.js')
    store = new TiDBStore()
    await store.initialize()
  } else {
    store = new SqliteStore(':memory:')
    await store.initialize()
  }
  app = createApp(store)
}

export default async function handler(req: any, res: any) {
  if (!initPromise) {
    initPromise = init()
  }
  await initPromise
  if (app) {
    app(req, res)
  } else {
    res.status(500).json({ error: 'App initialization failed' })
  }
}

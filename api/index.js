import { createApp } from '../dist/api/server.js'
import { SqliteStore } from '../dist/store/sqlite.js'

let app
let initPromise

async function init() {
  if (app) return

  if (process.env.TIDB_HOST) {
    const { TiDBStore } = await import('../dist/store/tidb.js')
    const store = new TiDBStore()
    await store.initialize()
    app = createApp(store)
  } else {
    const store = new SqliteStore(':memory:')
    await store.initialize()
    app = createApp(store)
  }
}

export default async function handler(req, res) {
  if (!initPromise) initPromise = init()
  await initPromise
  if (app) {
    app(req, res)
  } else {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'App initialization failed' }))
  }
}

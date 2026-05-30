import { createApp } from '../dist/api/server.js'
import { SqliteStore } from '../dist/store/sqlite.js'

let app
let initPromise = null

async function init() {
  if (app) return
  const store = new SqliteStore(':memory:')
  await store.initialize()
  app = createApp(store)
}

export default async function handler(req, res) {
  if (!initPromise) initPromise = init()
  await initPromise
  app(req, res)
}

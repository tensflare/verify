let app
let initPromise

async function init() {
  if (app) return
  const { createApp } = await import('../dist/api/server.js')
  const { SqliteStore } = await import('../dist/store/sqlite.js')
  const store = new SqliteStore(':memory:')
  await store.initialize()
  app = createApp(store)
}

export default async function handler(req, res) {
  if (!initPromise) initPromise = init()
  await initPromise
  app(req, res)
}

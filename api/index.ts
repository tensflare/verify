import { createApp } from '../src/api/server'
import { SqliteStore } from '../src/store/sqlite'
import { TiDBStore } from '../src/store/tidb'

let app: any
let initPromise: Promise<void> | null = null

async function init(): Promise<void> {
  if (app) return
  const store = process.env.TIDB_HOST
    ? new TiDBStore()
    : new SqliteStore(':memory:')
  await store.initialize()
  app = createApp(store)
}

export default async function handler(req: any, res: any) {
  if (!initPromise) initPromise = init()
  await initPromise
  app(req, res)
}

import { createApp } from '../src/api/server.js'
import { SqliteStore } from '../src/store/sqlite.js'
import type { Store } from '../src/store/index.js'

let store: Store
if (process.env['TIDB_HOST']) {
  const { TiDBStore } = await import('../src/store/tidb.js')
  store = new TiDBStore()
} else {
  store = new SqliteStore(':memory:')
}
await store.initialize()
const app = createApp(store)
export default app

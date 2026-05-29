import { createApp } from '../src/api/server.js'
import { TiDBStore } from '../src/store/tidb.js'

const store = new TiDBStore()
await store.initialize()
const app = createApp(store)
export default app

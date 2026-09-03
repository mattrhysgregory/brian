import { DEFAULT_PORT } from "@brian/shared";
import { createApp } from "./app";
import { createDb, defaultDbPath } from "./db";
import { createDefaultNotifier } from "./notify";

const port = Number(process.env.BRIAN_PORT ?? DEFAULT_PORT);
const dbPath = defaultDbPath();

const db = createDb(dbPath);
const app = createApp(db, { notify: createDefaultNotifier() });

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch: app.fetch,
  idleTimeout: 0,
});

console.log(`brian listening on http://${server.hostname}:${server.port}  (db: ${dbPath})`);

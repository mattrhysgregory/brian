import { DEFAULT_PORT } from "@brain/shared";
import { createApp } from "./app";
import { createDb, defaultDbPath } from "./db";

const port = Number(process.env.BRAIN_PORT ?? DEFAULT_PORT);
const dbPath = defaultDbPath();

const db = createDb(dbPath);
const app = createApp(db);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch: app.fetch,
  idleTimeout: 0,
});

console.log(`brain listening on http://${server.hostname}:${server.port}  (db: ${dbPath})`);

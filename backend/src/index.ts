import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { env } from './env.js';
import { createMockResponder } from './responder/mock.js';

const frontendDir = fileURLToPath(new URL('../../frontend/dist', import.meta.url));

const db = openDatabase(env.databasePath);
const app = createApp({
  db,
  responder: createMockResponder(env.mockResponseDelayMs),
  frontendDir: existsSync(frontendDir) ? frontendDir : undefined,
});

app.listen(env.port, (error) => {
  if (error) {
    console.error(`Couldn't start on port ${env.port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Cognibloom is running on http://localhost:${env.port} (database: ${env.databasePath})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    db.close();
    process.exit(0);
  });
}

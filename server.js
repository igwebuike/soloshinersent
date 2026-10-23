import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './src/config.js';
import { getPool } from './src/db/pool.js';
import { runMigrations } from './src/db/migrate.js';
import { seedInitialProducts } from './src/db/seed.js';
import { ensureInitialAdmin } from './src/auth/bootstrap.js';
import { createApp } from './src/app.js';

const config = loadConfig();
await mkdir(path.dirname(config.databasePath), { recursive: true });
await mkdir(config.uploadDir, { recursive: true });
const pool = getPool(config);
try {
  await runMigrations(pool);
  await seedInitialProducts(pool);
  await ensureInitialAdmin(pool, config);
} catch (error) {
  await pool.end();
  throw error;
}

const app = createApp({ pool, config, uploadDir: config.uploadDir });
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Shiner Scents is listening on port ${config.port}.`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}

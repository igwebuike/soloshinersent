import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSqliteDatabase } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedInitialProducts } from '../src/db/seed.js';
import { SqliteSessionStore } from '../src/auth/sqlite-session-store.js';

test('catalog and admin sessions remain on disk after the database is reopened', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'shiner-persistence-'));
  const databasePath = path.join(directory, 'store.sqlite');
  try {
    const firstStart = createSqliteDatabase(databasePath);
    await runMigrations(firstStart);
    await seedInitialProducts(firstStart);
    await firstStart.query(
      "INSERT INTO products (name, category, price_cents, is_published) VALUES ('Saved candle', 'Seasonal & Gifts', 2600, 1)",
    );
    const sessions = new SqliteSessionStore(firstStart.database);
    await new Promise((resolve, reject) => sessions.set('test-session', { adminId: 1 }, error => error ? reject(error) : resolve()));
    await firstStart.end();

    const afterRestart = createSqliteDatabase(databasePath);
    await runMigrations(afterRestart);
    const products = await afterRestart.query('SELECT name FROM products WHERE name = $1', ['Saved candle']);
    assert.equal(products.rows[0].name, 'Saved candle');
    const restoredSessions = new SqliteSessionStore(afterRestart.database);
    const restored = await new Promise((resolve, reject) => restoredSessions.get('test-session', (error, value) => error ? reject(error) : resolve(value)));
    assert.equal(restored.adminId, 1);
    await afterRestart.end();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

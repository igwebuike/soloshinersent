import assert from 'node:assert/strict';
import test from 'node:test';
import { createSqliteDatabase } from '../src/db/pool.js';

const { runMigrations } = await import('../src/db/migrate.js').catch(() => ({}));
const { seedInitialProducts } = await import('../src/db/seed.js').catch(() => ({}));

test('database migration and initial seed create the six current storefront products once', async () => {
  assert.equal(typeof runMigrations, 'function');
  assert.equal(typeof seedInitialProducts, 'function');
  const pool = createSqliteDatabase();

  await runMigrations(pool);
  await seedInitialProducts(pool);
  const { rows } = await pool.query('SELECT name, price_cents, image_path FROM products ORDER BY sort_order');

  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], {
    name: '10.5 oz Premium Black Jar',
    price_cents: 2400,
    image_path: '/assets/photo-10.jpg',
  });
  assert.deepEqual(rows[1], {
    name: '12 oz Signature Jar',
    price_cents: 2200,
    image_path: '/assets/photo-10.jpg',
  });
  await pool.query("DELETE FROM products WHERE seed_key = 'initial-01'");
  await seedInitialProducts(pool);
  const { rows: afterRestart } = await pool.query('SELECT name FROM products ORDER BY sort_order');
  assert.equal(afterRestart.length, 5, 'a product removed in the dashboard stays removed after startup seeding');
});

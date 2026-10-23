import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createSqliteDatabase } from '../src/db/pool.js';
import test from 'node:test';

const validationModule = await import('../src/products/validation.js').catch(() => ({}));
const productRouteModule = await import('../src/products/routes.js').catch(() => ({}));
const errorModule = await import('../src/errors.js').catch(() => ({}));
const { runMigrations } = await import('../src/db/migrate.js');
const { ensureInitialAdmin } = await import('../src/auth/bootstrap.js');
const { createAuthRouter } = await import('../src/auth/routes.js');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');

async function makePool() {
  const pool = createSqliteDatabase();
  await runMigrations(pool);
  return pool;
}

async function makeProductApp(pool, uploadDir) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(session({ secret: 'session-secret-is-over-32-characters-long', resave: false, saveUninitialized: false }));
  app.use('/api/admin', createAuthRouter({ pool }));
  app.use('/api', productRouteModule.createProductRouter({ pool, uploadDir }));
  app.use(errorModule.errorHandler);
  return app;
}

const productInput = {
  name: 'Summer Citrus Glow',
  description: 'Bright citrus with a gentle vanilla finish.',
  category: 'Signature Scents',
  price: '24.44',
  isAvailable: true,
  isPublished: false,
};

test('product form values normalize to cents and preserve plain-language description fields', () => {
  assert.equal(typeof validationModule.validateProduct, 'function');
  const result = validationModule.validateProduct({ ...productInput, name: '  Summer Citrus Glow  ' });
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.name, 'Summer Citrus Glow');
  assert.equal(result.value.description, 'Bright citrus with a gentle vanilla finish.');
  assert.equal(result.value.priceCents, 2444);
  assert.equal(result.value.category, 'Signature Scents');
  assert.equal(result.value.isPublished, false);
});

test('product validation reports missing names and invalid prices as field errors', () => {
  const result = validationModule.validateProduct({ ...productInput, name: ' ', price: 'free' });
  assert.match(result.errors.name, /name/i);
  assert.match(result.errors.price, /price/i);
});

test('product validation treats price as dollars, keeps priceCents explicit, and rejects malformed field types', () => {
  const dollars = validationModule.validateProduct({ ...productInput, price: 24 });
  assert.equal(dollars.value.priceCents, 2400);
  const cents = validationModule.validateProduct({ ...productInput, price: undefined, priceCents: 2444 });
  assert.equal(cents.value.priceCents, 2444);
  const malformed = validationModule.validateProduct({
    ...productInput, name: { title: 'Jar' }, price: 24.5, isAvailable: 'yes', sortOrder: 2 ** 40,
  });
  assert.match(malformed.errors.name, /text|name/i);
  assert.match(malformed.errors.isAvailable, /choose|available/i);
  assert.match(malformed.errors.sortOrder, /order/i);
  assert.equal(malformed.value.priceCents, 2450);
});

test('admin can create, edit, publish, hide, and delete products while public users see published products only', async () => {
  assert.equal(typeof productRouteModule.createProductRouter, 'function');
  assert.equal(typeof errorModule.errorHandler, 'function');
  const pool = await makePool();
  await pool.query("INSERT INTO products (name, category, price_cents, is_published) VALUES ('Visible Jar', 'Signature Scents', 1200, TRUE)");
  await pool.query("INSERT INTO products (name, category, price_cents, is_published) VALUES ('Hidden Jar', 'Signature Scents', 1300, FALSE)");
  await ensureInitialAdmin(pool, { adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!' });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-products-'));
  try {
    const agent = request.agent(await makeProductApp(pool, uploadDir));
    assert.equal((await agent.get('/api/admin/products')).status, 401);
    assert.equal((await agent.post('/api/admin/products').send(productInput)).status, 401);
    assert.equal((await agent.patch('/api/admin/products/1').send(productInput)).status, 401);
    assert.equal((await agent.patch('/api/admin/products/1/publication').send({ isPublished: true })).status, 401);
    assert.equal((await agent.delete('/api/admin/products/1')).status, 401);
    const publicBefore = await agent.get('/api/products');
    assert.equal(publicBefore.status, 200);
    assert.deepEqual(publicBefore.body.map(p => p.name), ['Visible Jar']);
    await agent.post('/api/admin/login').send({ email: 'serrell@example.com', password: 'Serrell-good-password-2026!' }).expect(200);

    const created = await agent.post('/api/admin/products').send(productInput).expect(201);
    const id = created.body.id;
    assert.equal(created.body.priceCents, 2444);
    assert.equal(created.body.isPublished, false);
    assert.equal(created.body.imagePath, '/assets/product-placeholder.svg');

    const invalid = await agent.patch(`/api/admin/products/${id}`).send({ ...productInput, name: '', price: '0' }).expect(400);
    assert.match(invalid.body.fieldErrors.name, /name/i);
    assert.match(invalid.body.fieldErrors.price, /price/i);

    const published = await agent.patch(`/api/admin/products/${id}`).send({ ...productInput, name: 'Summer Citrus Glow', isPublished: true }).expect(200);
    assert.equal(published.body.isPublished, true);
    assert.equal((await agent.get('/api/products')).body.some(p => p.name === 'Summer Citrus Glow'), true);

    await agent.patch(`/api/admin/products/${id}/publication`).send({ isPublished: false }).expect(200);
    assert.equal((await agent.get('/api/products')).body.some(p => p.name === 'Summer Citrus Glow'), false);
    await agent.delete(`/api/admin/products/${id}`).expect(204);
    const adminProducts = await agent.get('/api/admin/products').expect(200);
    assert.equal(adminProducts.body.some(p => p.id === id), false);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
    await pool.end();
  }
});

test('replacing and deleting a product photo removes only the prior uploaded photo', async () => {
  const pool = await makePool();
  await ensureInitialAdmin(pool, { adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!' });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-photos-'));
  try {
    const agent = request.agent(await makeProductApp(pool, uploadDir));
    await agent.post('/api/admin/login').send({ email: 'serrell@example.com', password: 'Serrell-good-password-2026!' }).expect(200);
    const created = await agent.post('/api/admin/products')
      .field('name', productInput.name).field('description', productInput.description)
      .field('category', productInput.category).field('price', productInput.price)
      .field('isAvailable', 'true').field('isPublished', 'false')
      .attach('image', png, { filename: 'first.png', contentType: 'image/png' }).expect(201);
    const firstPath = created.body.imagePath;
    assert.match(firstPath, /^\/uploads\/[a-f0-9-]+\.png$/);
    const firstFile = path.join(uploadDir, path.basename(firstPath));
    assert.ok((await readFile(firstFile)).length > 0);

    const edited = await agent.patch(`/api/admin/products/${created.body.id}`)
      .field('name', productInput.name).field('description', productInput.description)
      .field('category', productInput.category).field('price', productInput.price)
      .field('isAvailable', 'true').field('isPublished', 'false')
      .attach('image', png, { filename: 'replacement.png', contentType: 'image/png' }).expect(200);
    const replacementFile = path.join(uploadDir, path.basename(edited.body.imagePath));
    await assert.rejects(readFile(firstFile), { code: 'ENOENT' });
    assert.ok((await readFile(replacementFile)).length > 0);

    await agent.delete(`/api/admin/products/${created.body.id}`).expect(204);
    await assert.rejects(readFile(replacementFile), { code: 'ENOENT' });
    assert.deepEqual(await readdir(uploadDir), []);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
    await pool.end();
  }
});

test('failed product creation removes the uploaded photo', async () => {
  const pool = await makePool();
  await ensureInitialAdmin(pool, { adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!' });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-failed-create-'));
  const failingPool = {
    query(sql, params) {
      if (String(sql).includes('INSERT INTO products')) return Promise.reject(new Error('database unavailable'));
      return pool.query(sql, params);
    },
  };
  try {
    const agent = request.agent(await makeProductApp(failingPool, uploadDir));
    await agent.post('/api/admin/login').send({ email: 'serrell@example.com', password: 'Serrell-good-password-2026!' }).expect(200);
    await agent.post('/api/admin/products')
      .field('name', productInput.name).field('description', productInput.description)
      .field('category', productInput.category).field('price', productInput.price)
      .attach('image', png, { filename: 'failed.png', contentType: 'image/png' }).expect(500);
    assert.deepEqual(await readdir(uploadDir), []);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
    await pool.end();
  }
});

test('failed product lookup and update remove replacement photos', async () => {
  const pool = await makePool();
  await ensureInitialAdmin(pool, { adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!' });
  const { rows } = await pool.query(
    "INSERT INTO products (name, category, price_cents) VALUES ('Existing jar', 'Signature Scents', 2400) RETURNING id",
  );
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-failed-edit-'));
  let failureMode = 'lookup';
  const failingPool = {
    query(sql, params) {
      const statement = String(sql);
      if (failureMode === 'lookup' && statement.includes('FROM products WHERE id = $1')) {
        return Promise.reject(new Error('database read unavailable'));
      }
      if (failureMode === 'update' && statement.includes('UPDATE products SET')) {
        return Promise.reject(new Error('database write unavailable'));
      }
      return pool.query(sql, params);
    },
  };
  try {
    const agent = request.agent(await makeProductApp(failingPool, uploadDir));
    await agent.post('/api/admin/login').send({ email: 'serrell@example.com', password: 'Serrell-good-password-2026!' }).expect(200);
    const uploadedEdit = () => agent.patch(`/api/admin/products/${rows[0].id}`)
      .field('name', productInput.name).field('description', productInput.description)
      .field('category', productInput.category).field('price', productInput.price)
      .attach('image', png, { filename: 'failed-edit.png', contentType: 'image/png' });

    await uploadedEdit().expect(500);
    assert.deepEqual(await readdir(uploadDir), []);
    failureMode = 'update';
    await uploadedEdit().expect(500);
    assert.deepEqual(await readdir(uploadDir), []);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
    await pool.end();
  }
});

test('a description edit concurrent with photo replacement keeps the replacement photo path', async () => {
  const pool = await makePool();
  await ensureInitialAdmin(pool, { adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!' });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-concurrent-'));
  let releaseFirstUpdate;
  let firstUpdateEntered;
  const entered = new Promise(resolve => { firstUpdateEntered = resolve; });
  const release = new Promise(resolve => { releaseFirstUpdate = resolve; });
  let updateCount = 0;
  const coordinatedPool = {
    async query(sql, params) {
      if (String(sql).includes('UPDATE products SET')) {
        updateCount += 1;
        if (updateCount === 1) {
          firstUpdateEntered();
          await release;
        }
      }
      return pool.query(sql, params);
    },
  };
  try {
    const agent = request.agent(await makeProductApp(coordinatedPool, uploadDir));
    await agent.post('/api/admin/login').send({ email: 'serrell@example.com', password: 'Serrell-good-password-2026!' }).expect(200);
    const created = await agent.post('/api/admin/products')
      .field('name', productInput.name).field('description', productInput.description)
      .field('category', productInput.category).field('price', productInput.price)
      .attach('image', png, { filename: 'original.png', contentType: 'image/png' }).expect(201);
    const id = created.body.id;
    const descriptionEdit = agent.patch(`/api/admin/products/${id}`)
      .send({ ...productInput, description: 'Updated description.' }).then(response => response);
    await entered;
    const replacement = await agent.patch(`/api/admin/products/${id}`)
      .field('name', productInput.name).field('description', productInput.description)
      .field('category', productInput.category).field('price', productInput.price)
      .attach('image', png, { filename: 'replacement.png', contentType: 'image/png' }).expect(200);
    releaseFirstUpdate();
    assert.equal((await descriptionEdit).status, 200);
    const current = await pool.query('SELECT image_path FROM products WHERE id = $1', [id]);
    assert.equal(current.rows[0].image_path, replacement.body.imagePath);
    assert.ok((await readFile(path.join(uploadDir, path.basename(replacement.body.imagePath)))).length > 0);
  } finally {
    releaseFirstUpdate();
    await rm(uploadDir, { recursive: true, force: true });
    await pool.end();
  }
});

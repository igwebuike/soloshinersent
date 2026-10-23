import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { createSqliteDatabase } from '../src/db/pool.js';
import test from 'node:test';

const passwordModule = await import('../src/auth/passwords.js').catch(() => ({}));
const bootstrapModule = await import('../src/auth/bootstrap.js').catch(() => ({}));
const routeModule = await import('../src/auth/routes.js').catch(() => ({}));
const sessionModule = await import('../src/auth/session.js').catch(() => ({}));
const middlewareModule = await import('../src/auth/require-admin.js').catch(() => ({}));
const { runMigrations } = await import('../src/db/migrate.js');

async function makePool() {
  const pool = createSqliteDatabase();
  await runMigrations(pool);
  return pool;
}

function makeAuthApp(pool) {
  const app = express();
  app.use(express.json());
  app.use(sessionModule.createSessionMiddleware({
    config: { sessionSecret: 'unit-test-session-secret-is-at-least-32-chars', secureCookies: false },
    store: new session.MemoryStore(),
  }));
  app.use('/api/admin', routeModule.createAuthRouter({ pool }));
  app.get('/private', middlewareModule.requireAdmin, (_req, res) => res.json({ ok: true }));
  return app;
}

test('password hashes verify the correct password and reject another password', async () => {
  assert.equal(typeof passwordModule.hashPassword, 'function');
  const hash = await passwordModule.hashPassword('Serrell-good-password-2026!');
  assert.notEqual(hash, 'Serrell-good-password-2026!');
  assert.equal(await passwordModule.verifyPassword('Serrell-good-password-2026!', hash), true);
  assert.equal(await passwordModule.verifyPassword('wrong-password', hash), false);
});

test('bootstrap creates the first admin once and never resets an existing password', async () => {
  assert.equal(typeof bootstrapModule.ensureInitialAdmin, 'function');
  const pool = await makePool();
  const config = { adminEmail: 'SERRELL@example.com', adminPassword: 'Serrell-good-password-2026!' };
  await bootstrapModule.ensureInitialAdmin(pool, config);
  await pool.query("UPDATE admin_users SET password_hash = 'changed-hash'");
  await bootstrapModule.ensureInitialAdmin(pool, config);
  const { rows } = await pool.query('SELECT email, password_hash FROM admin_users');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, 'serrell@example.com');
  assert.equal(rows[0].password_hash, 'changed-hash');
});

test('bootstrap rejects blank and known placeholder passwords', async () => {
  const pool = await makePool();
  for (const adminPassword of ['            ', 'change-me-render-admin-password', 'password123456']) {
    await assert.rejects(
      bootstrapModule.ensureInitialAdmin(pool, { adminEmail: 'owner@example.com', adminPassword }),
      /strong.*password|non-example/i,
    );
  }
});

test('login creates a session, logout clears it, and private routes reject signed-out users', async () => {
  assert.equal(typeof routeModule.createAuthRouter, 'function');
  assert.equal(typeof sessionModule.createSessionMiddleware, 'function');
  assert.equal(typeof middlewareModule.requireAdmin, 'function');
  const pool = await makePool();
  await bootstrapModule.ensureInitialAdmin(pool, {
    adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!',
  });
  const agent = request.agent(makeAuthApp(pool));

  assert.equal((await agent.get('/private')).status, 401);
  assert.equal((await agent.get('/api/admin/session')).body.authenticated, false);
  const loginResponse = await agent.post('/api/admin/login').send({
    email: 'SERRELL@example.com', password: 'Serrell-good-password-2026!',
  });
  assert.equal(loginResponse.status, 200);
  assert.match(loginResponse.headers['set-cookie'][0], /^shiner\.sid=/);
  assert.match(loginResponse.headers['set-cookie'][0], /HttpOnly/);
  assert.match(loginResponse.headers['set-cookie'][0], /SameSite=Strict/);
  assert.equal((await agent.get('/api/admin/session')).body.authenticated, true);
  assert.equal((await agent.get('/private')).status, 200);
  assert.equal((await agent.post('/api/admin/logout')).status, 204);
  assert.equal((await agent.get('/api/admin/session')).body.authenticated, false);
  assert.equal((await agent.get('/private')).status, 401);
});

test('sign-in attempts are rate limited after ten failures', async () => {
  const pool = await makePool();
  const app = makeAuthApp(pool);
  app.set('trust proxy', 1);
  const agent = request.agent(app);
  const statuses = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await agent.post('/api/admin/login')
      .set('X-Forwarded-For', '198.51.100.18')
      .send({ email: 'unknown@example.com', password: 'wrong-password' });
    statuses.push(response.status);
  }
  assert.equal(statuses.slice(0, 10).every(status => status === 401), true);
  assert.equal(statuses[10], 429);
});

test('invalid credentials do not create a session', async () => {
  const pool = await makePool();
  await bootstrapModule.ensureInitialAdmin(pool, {
    adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!',
  });
  const agent = request.agent(makeAuthApp(pool));
  const response = await agent.post('/api/admin/login').send({
    email: 'serrell@example.com', password: 'not-the-password',
  });
  assert.equal(response.status, 401);
  assert.equal((await agent.get('/api/admin/session')).body.authenticated, false);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import test from 'node:test';
import expressSession from 'express-session';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSqliteDatabase } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
const { createApp } = await import('../src/app.js');

const { validateRenderBlueprint } = await import('../scripts/validate-render-config.js').catch(() => ({}));
const renderYaml = await readFile(new URL('../render.yaml', import.meta.url), 'utf8').catch(() => '');

test('Render Blueprint uses the persistent disk for SQLite data and uploaded photos', () => {
  assert.equal(typeof validateRenderBlueprint, 'function');
  const blueprint = validateRenderBlueprint(renderYaml);
  const service = blueprint.services[0];
  assert.equal(service.type, 'web');
  assert.equal(service.runtime, 'node');
  assert.equal(service.healthCheckPath, '/healthz');
  assert.equal(service.disk.mountPath, '/var/data');
  const env = Object.fromEntries(service.envVars.map(item => [item.key, item]));
  assert.equal(env.DATABASE_PATH.value, '/var/data/shiner-scents.sqlite');
  assert.equal(env.UPLOAD_DIR.value, '/var/data/uploads');
});

test('Render Blueprint keeps first-admin credentials unset in source and generates the session secret', () => {
  const blueprint = validateRenderBlueprint(renderYaml);
  const env = Object.fromEntries(blueprint.services[0].envVars.map(item => [item.key, item]));
  assert.equal(env.ADMIN_EMAIL.sync, false);
  assert.equal(env.ADMIN_PASSWORD.sync, false);
  assert.equal(env.SESSION_SECRET.generateValue, true);
  assert.equal(env.NODE_ENV.value, 'production');
});

test('Render Blueprint validator rejects a service without persistent image storage', () => {
  const blueprint = parse(renderYaml);
  delete blueprint.services[0].disk;
  assert.throws(() => validateRenderBlueprint(stringify(blueprint)), /persistent disk/i);
});


test('local HTTP smoke test serves health, storefront, public client, and login routes', async () => {
  const pool = createSqliteDatabase();
  await runMigrations(pool);
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-smoke-'));
  const app = createApp({
    pool,
    uploadDir,
    config: { sessionSecret: 'session-secret-is-over-32-characters-long', secureCookies: false },
    sessionStore: new expressSession.MemoryStore(),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const home = await fetch(baseUrl);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Shiner Scents/);
    const clientScript = await fetch(`${baseUrl}/public.js`);
    assert.equal(clientScript.status, 200);
    const login = await fetch(`${baseUrl}/admin/login`);
    assert.equal(login.status, 200);
    assert.match(await login.text(), /Sign in to your studio/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import expressSession from 'express-session';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { newDb } from 'pg-mem';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const { createApp } = await import('../src/app.js').catch(() => ({}));
const { runMigrations } = await import('../src/db/migrate.js');
const { ensureInitialAdmin } = await import('../src/auth/bootstrap.js');

async function setup() {
  const memoryDb = newDb();
  const { Pool } = memoryDb.adapters.createPg();
  const pool = new Pool();
  await runMigrations(pool);
  await ensureInitialAdmin(pool, {
    adminEmail: 'serrell@example.com', adminPassword: 'Serrell-good-password-2026!',
  });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-admin-ui-'));
  const app = createApp({
    pool,
    uploadDir,
    config: { sessionSecret: 'session-secret-is-over-32-characters-long', secureCookies: false },
    sessionStore: new expressSession.MemoryStore(),
  });
  return { app, pool, uploadDir };
}

test('admin login is public but the dashboard redirects signed-out visitors', async () => {
  assert.equal(typeof createApp, 'function');
  const { app, pool, uploadDir } = await setup();
  try {
    await request(app).get('/admin/login').expect(200).expect('Content-Type', /html/);
    const redirect = await request(app).get('/admin').expect(302);
    assert.equal(redirect.headers.location, '/admin/login');
  } finally {
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test('signed-in product workspace exposes plain-language fields and common product actions', async () => {
  const { app, pool, uploadDir } = await setup();
  try {
    const agent = request.agent(app);
    const loginPage = await agent.get('/admin/login').expect(200);
    assert.match(loginPage.text, /Email address/);
    assert.match(loginPage.text, /Password/);
    await agent.post('/api/admin/login').send({
      email: 'serrell@example.com', password: 'Serrell-good-password-2026!',
    }).expect(200);
    const dashboard = await agent.get('/admin').expect(200);
    for (const text of ['Products', 'Add product', 'Product name', 'Description', 'Price', 'Category', 'Upload a photo', 'Publish', 'Delete']) {
      assert.ok(dashboard.text.includes(text), `Dashboard should include ${text}`);
    }
    assert.match(dashboard.text, /accept="image\/jpeg,image\/png,image\/webp"/);
    assert.match(dashboard.text, /id="product-editor"/);
  } finally {
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});


test('product editor adds, edits, and removes products using simple form fields', async () => {
  const { app, pool, uploadDir } = await setup();
  try {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({
      email: 'serrell@example.com', password: 'Serrell-good-password-2026!',
    }).expect(200);
    const html = await agent.get('/admin').expect(200);
    const script = await agent.get('/admin/admin.js').expect(200);
    const dom = new JSDOM(html.text, { url: 'https://shop.example.test/admin', runScripts: 'outside-only' });
    const dialog = dom.window.document.querySelector('#product-editor');
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
    dom.window.confirm = () => true;
    let pendingRequests = 0;
    dom.window.fetch = async (url, options = {}) => {
      pendingRequests += 1;
      let call = agent[(options.method || 'GET').toLowerCase()](url);
      if (options.body instanceof dom.window.FormData) {
        for (const [name, value] of options.body.entries()) {
          if (typeof value === 'string') call = call.field(name, value);
        }
      } else if (typeof options.body === 'string') {
        call = call.set('Content-Type', 'application/json').send(JSON.parse(options.body));
      }
      const response = await call;
      pendingRequests -= 1;
      return { status: response.status, ok: response.status < 400, json: async () => response.body };
    };
    dom.window.eval(script.text);
    const settle = async () => {
      for (let attempt = 0; attempt < 100 && pendingRequests > 0; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
    await settle();

    dom.window.document.querySelector('#add-product').click();
    dom.window.document.querySelector('#product-name').value = 'Harvest Spice';
    dom.window.document.querySelector('#product-description').value = 'Warm cinnamon and clove for cozy evenings.';
    dom.window.document.querySelector('#product-category').value = 'Seasonal & Gifts';
    dom.window.document.querySelector('#product-price').value = '26.50';
    dom.window.document.querySelector('#product-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert.match(dom.window.document.querySelector('#product-list').textContent, /Harvest Spice/);
    assert.equal(dom.window.document.querySelector('#total-count').textContent, '1');

    dom.window.document.querySelector('[data-action="edit"]').click();
    dom.window.document.querySelector('#product-description').value = 'Updated cozy cinnamon blend.';
    dom.window.document.querySelector('#product-price').value = '28.00';
    dom.window.document.querySelector('#product-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert.match(dom.window.document.querySelector('#product-list').textContent, /\$28\.00/);

    dom.window.document.querySelector('[data-action="delete"]').click();
    await settle();
    assert.doesNotMatch(dom.window.document.querySelector('#product-list').textContent, /Harvest Spice/);
    assert.equal(dom.window.document.querySelector('#total-count').textContent, '0');
    dom.window.close();
  } finally {
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});

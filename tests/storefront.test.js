import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import request from 'supertest';
import { newDb } from 'pg-mem';
import test from 'node:test';
import expressSession from 'express-session';

const { createApp } = await import('../src/app.js');
const { runMigrations } = await import('../src/db/migrate.js');

const sampleProducts = [{
  id: 91,
  name: '<img src=x onerror=alert(1)> Citrus Glow',
  description: '<script>steal()</script> Bright citrus and vanilla.',
  category: 'Signature Scents',
  priceCents: 2444,
  imagePath: '/assets/photo-10.jpg',
  isAvailable: true,
  isPublished: true,
}];

async function makeApp() {
  const memoryDb = newDb();
  const { Pool } = memoryDb.adapters.createPg();
  const pool = new Pool();
  await runMigrations(pool);
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-storefront-'));
  const app = createApp({
    pool,
    uploadDir,
    config: { sessionSecret: 'session-secret-is-over-32-characters-long', secureCookies: false },
    sessionStore: new expressSession.MemoryStore(),
  });
  return { app, pool, uploadDir };
}

async function renderStorefront(products = sampleProducts, apiFails = false) {
  const { app, pool, uploadDir } = await makeApp();
  const html = await request(app).get('/').expect(200);
  const script = await request(app).get('/public.js').expect(200);
  const dom = new JSDOM(html.text, { url: 'https://shop.example.test/', runScripts: 'outside-only' });
  dom.window.fetch = async url => ({
    ok: url === '/api/products' && !apiFails,
    status: url === '/api/products' && !apiFails ? 200 : 503,
    json: async () => apiFails ? { error: 'Store is taking a short break.' } : url === '/api/products' ? products : { error: 'Not found' },
  });
  dom.window.eval(script.text);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { dom, pool, uploadDir };
}

test('storefront loads product-rendering script and populates product cards from published API data', async () => {
  const { dom, pool, uploadDir } = await renderStorefront();
  try {
    assert.match(dom.window.document.querySelector('#productGrid').textContent, /Citrus Glow/);
    assert.match(dom.window.document.querySelector('#productGrid').textContent, /\$24\.44/);
    assert.equal(dom.window.document.querySelector('#productGrid img').getAttribute('src'), '/assets/photo-10.jpg');
    assert.equal(dom.window.document.querySelector('#productGrid article').dataset.productId, '91');
  } finally {
    dom.window.close();
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test('product names and descriptions render as text instead of executable markup', async () => {
  const { dom, pool, uploadDir } = await renderStorefront();
  try {
    const card = dom.window.document.querySelector('#productGrid article');
    assert.match(card.textContent, /<img src=x onerror=alert\(1\)> Citrus Glow/);
    assert.match(card.textContent, /<script>steal\(\)<\/script>/);
    assert.equal(card.querySelector('script'), null);
    assert.equal(card.querySelectorAll('img').length, 1);
  } finally {
    dom.window.close();
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test('storefront cart totals, removes items, and builds an email inquiry with product choices', async () => {
  const { dom, pool, uploadDir } = await renderStorefront();
  try {
    const { document } = dom.window;
    document.querySelector('[data-add-to-bag]').click();
    document.querySelector('#qty').value = '2';
    document.querySelector('#scent').value = 'Harvest Spice';
    document.querySelector('#color').value = 'As pictured';
    document.querySelector('#addToBag').click();
    assert.equal(document.querySelector('#count').textContent, '2');
    assert.match(document.querySelector('#total').textContent, /\$48\.88/);
    assert.match(document.querySelector('#cartItems').textContent, /Harvest Spice/);
    const inquiry = new URL(dom.window.buildInquiryUrl());
    assert.equal(inquiry.protocol, 'mailto:');
    assert.equal(inquiry.pathname, 'soloshiners21@yahoo.com');
    assert.match(inquiry.searchParams.get('body'), /2 x <img src=x onerror=alert\(1\)> Citrus Glow/);
    document.querySelector('.cartline button[data-remove]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    assert.equal(document.querySelector('#count').textContent, '0');
  } finally {
    dom.window.close();
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test('empty product API shows a friendly shop message', async () => {
  const { dom, pool, uploadDir } = await renderStorefront([]);
  try {
    assert.match(dom.window.document.querySelector('#productGrid').textContent, /products are on their way/i);
  } finally {
    dom.window.close();
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});


test('product API errors show a helpful message instead of a broken product grid', async () => {
  const { dom, pool, uploadDir } = await renderStorefront([], true);
  try {
    assert.match(dom.window.document.querySelector('#productGrid').textContent, /temporarily unavailable/i);
  } finally {
    dom.window.close();
    await pool.end();
    await rm(uploadDir, { recursive: true, force: true });
  }
});

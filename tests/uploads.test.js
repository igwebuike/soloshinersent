import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import test from 'node:test';

const uploadModule = await import('../src/uploads/storage.js').catch(() => ({}));
const errorModule = await import('../src/errors.js').catch(() => ({}));
const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');

async function makeUploadApp(uploadDir) {
  const app = express();
  app.post('/upload', uploadModule.createImageUpload(uploadDir), uploadModule.verifyUploadedImage,
    (req, res) => res.json({ filename: req.file?.filename || null, path: req.file?.publicPath || null }));
  app.use(errorModule.errorHandler);
  return app;
}

test('image upload accepts a real PNG with a generated safe filename', async () => {
  assert.equal(typeof uploadModule.createImageUpload, 'function');
  assert.equal(typeof uploadModule.verifyUploadedImage, 'function');
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-upload-'));
  try {
    const response = await request(await makeUploadApp(uploadDir)).post('/upload')
      .attach('image', validPng, { filename: 'my candle.png', contentType: 'image/png' }).expect(200);
    assert.match(response.body.filename, /^[a-f0-9-]+\.png$/);
    assert.equal(response.body.path, `/uploads/${response.body.filename}`);
    assert.deepEqual(await readdir(uploadDir), [response.body.filename]);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test('image upload rejects non-image, spoofed image, and files larger than 8 MiB without leaving files', async () => {
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'shiner-upload-'));
  try {
    const app = await makeUploadApp(uploadDir);
    await request(app).post('/upload')
      .attach('image', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' }).expect(400);
    await request(app).post('/upload')
      .attach('image', Buffer.from('not a real png'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
    await request(app).post('/upload')
      .attach('image', Buffer.concat([validPng, Buffer.alloc(8 * 1024 * 1024 + 1)]), { filename: 'large.png', contentType: 'image/png' }).expect(413);
    assert.deepEqual(await readdir(uploadDir), []);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

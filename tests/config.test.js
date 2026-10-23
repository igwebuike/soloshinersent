import assert from 'node:assert/strict';
import test from 'node:test';

const { loadConfig } = await import('../src/config.js').catch(() => ({}));

test('loadConfig requires DATABASE_PATH, SESSION_SECRET, and UPLOAD_DIR', () => {
  assert.throws(() => loadConfig({}), /DATABASE_PATH/);
  assert.throws(() => loadConfig({ DATABASE_PATH: './data/test.sqlite' }), /SESSION_SECRET/);
  assert.throws(() => loadConfig({
    DATABASE_PATH: './data/test.sqlite',
    SESSION_SECRET: 'x'.repeat(40),
  }), /UPLOAD_DIR/);
});

test('loadConfig rejects a session secret shorter than 32 characters', () => {
  assert.throws(() => loadConfig({
    DATABASE_PATH: './data/test.sqlite',
    SESSION_SECRET: 'too-short',
    UPLOAD_DIR: '/tmp/shiner-uploads',
  }), /32/);
});

test('loadConfig rejects obvious placeholder and repeated session secrets', () => {
  for (const SESSION_SECRET of ['replace-this-with-a-long-random-secret-123456', 's'.repeat(40)]) {
    assert.throws(() => loadConfig({
      DATABASE_PATH: './data/test.sqlite', SESSION_SECRET, UPLOAD_DIR: '/tmp/shiner-uploads',
      NODE_ENV: 'production',
    }), /random|placeholder|secret/i);
  }
});

test('loadConfig enables secure cookies in production and defaults the port', () => {
  const config = loadConfig({
    DATABASE_PATH: './data/test.sqlite',
    SESSION_SECRET: 'aB3!kL9@qR2#sT7%vX5^mN8&cP4*dF6h',
    UPLOAD_DIR: '/tmp/shiner-uploads',
    NODE_ENV: 'production',
  });
  assert.equal(config.port, 3000);
  assert.equal(config.secureCookies, true);
  assert.equal(config.uploadDir, '/tmp/shiner-uploads');
});

import { readFile } from 'node:fs/promises';

const schemaUrl = new URL('./schema.sql', import.meta.url);

export async function runMigrations(pool) {
  const schema = (await readFile(schemaUrl, 'utf8'))
    .replace(/BIGSERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/TIMESTAMPTZ/g, 'TEXT')
    .replace(/BOOLEAN/g, 'INTEGER')
    .replace(/DEFAULT NOW\(\)/g, 'DEFAULT CURRENT_TIMESTAMP');
  pool.database.exec(schema);
}

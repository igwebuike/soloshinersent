import { readFile } from 'node:fs/promises';

const schemaUrl = new URL('./schema.sql', import.meta.url);

export async function runMigrations(pool) {
  const schema = await readFile(schemaUrl, 'utf8');
  await pool.query(schema);
}

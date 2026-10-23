import pg from 'pg';

export function getPool(config) {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.environment === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

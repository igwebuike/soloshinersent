import { DatabaseSync } from 'node:sqlite';

function toSqlite(sql) {
  return String(sql)
    .replace(/\$(\d+)/g, '?$1')
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
}

export function createSqliteDatabase(databasePath = ':memory:') {
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

  const client = {
    async query(sql, params = []) {
      const statement = toSqlite(sql).trim();
      const bindings = params.map(value => value === undefined ? null : typeof value === 'boolean' ? Number(value) : value);
      if (!params.length && /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(statement)) {
        database.exec(statement);
        return { rows: [], rowCount: 0 };
      }
      if (!params.length && statement.includes(';') && !/^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i.test(statement)) {
        database.exec(statement);
        return { rows: [], rowCount: 0 };
      }
      const result = database.prepare(statement);
      const isRead = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(statement);
      const rows = isRead || /\bRETURNING\b/i.test(statement)
        ? result.all(...bindings)
        : [];
      const runResult = isRead || /\bRETURNING\b/i.test(statement)
        ? { changes: rows.length }
        : result.run(...bindings);
      return {
        rows: rows.map(row => {
          const output = { ...row };
          for (const key of ['isAvailable', 'isPublished']) {
            if (key in output) output[key] = Boolean(output[key]);
          }
          return output;
        }),
        rowCount: runResult.changes ?? rows.length,
      };
    },
    async connect() {
      return { ...client, release() {} };
    },
    async end() {
      database.close();
    },
    database,
  };

  return client;
}

export function getPool(config) {
  return createSqliteDatabase(config.databasePath);
}

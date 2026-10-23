import session from 'express-session';
import { SqliteSessionStore } from './sqlite-session-store.js';

export function createSessionMiddleware({ pool, config, store } = {}) {
  const sessionStore = store || new SqliteSessionStore(pool.database);

  return session({
    name: 'shiner.sid',
    store: sessionStore,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: Boolean(config.secureCookies),
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  });
}

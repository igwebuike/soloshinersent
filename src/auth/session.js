import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const PgStore = connectPgSimple(session);

export function createSessionMiddleware({ pool, config, store } = {}) {
  const sessionStore = store || new PgStore({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
  });

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

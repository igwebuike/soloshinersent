const MIN_SESSION_SECRET_LENGTH = 32;

export function loadConfig(env = process.env) {
  const required = ['DATABASE_PATH', 'SESSION_SECRET', 'UPLOAD_DIR'];
  for (const key of required) {
    if (!String(env[key] ?? '').trim()) {
      throw new Error(`${key} is required.`);
    }
  }

  const sessionSecret = String(env.SESSION_SECRET);
  const exampleSecret = /change[-_ ]?me|replace|example|sample|placeholder|your[-_ ]|secret[-_ ]?here/i.test(sessionSecret);
  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH || new Set(sessionSecret).size < 8 || exampleSecret) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters, random, and not an example value.`);
  }

  const environment = env.NODE_ENV || 'development';
  return {
    databasePath: env.DATABASE_PATH,
    sessionSecret,
    uploadDir: env.UPLOAD_DIR,
    port: Number.parseInt(env.PORT || '3000', 10),
    environment,
    secureCookies: environment === 'production',
    adminEmail: env.ADMIN_EMAIL?.trim().toLowerCase() || '',
    adminPassword: env.ADMIN_PASSWORD || '',
  };
}

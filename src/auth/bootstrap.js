import { hashPassword } from './passwords.js';

const EXAMPLE_PASSWORDS = new Set([
  'change-me-render-admin-password',
  'replace-with-a-long-random-password',
  'password123456',
  'your-admin-password-here',
]);

function isStrongInitialPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || !password.trim()) return false;
  const normalized = password.toLowerCase();
  if (EXAMPLE_PASSWORDS.has(normalized) || /^(.)\1+$/.test(password)) return false;
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
  return classes.filter(Boolean).length >= 3;
}

export async function ensureInitialAdmin(pool, config) {
  const { rows } = await pool.query('SELECT id FROM admin_users ORDER BY id LIMIT 1');
  if (rows.length) return { created: false };

  const email = String(config.adminEmail || '').trim().toLowerCase();
  const password = config.adminPassword;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set a valid ADMIN_EMAIL in Render to create the first admin account.');
  }
  if (!isStrongInitialPassword(password)) {
    throw new Error('Set ADMIN_PASSWORD in Render to a strong, non-example password of at least 12 characters using at least three character types.');
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)',
    [email, passwordHash],
  );
  return { created: true };
}

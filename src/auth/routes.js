import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyPassword } from './passwords.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
}

export function createAuthRouter({ pool }) {
  const router = express.Router();

  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = req.body?.password;
      const { rows } = await pool.query(
        'SELECT id, email, password_hash FROM admin_users WHERE email = $1 LIMIT 1',
        [email],
      );
      const admin = rows[0];
      const valid = admin && await verifyPassword(password, admin.password_hash);
      if (!valid) return res.status(401).json({ error: 'Email or password is incorrect.' });

      await regenerateSession(req);
      req.session.adminId = admin.id;
      req.session.adminEmail = admin.email;
      await saveSession(req);
      return res.json({ authenticated: true, email: admin.email });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', (req, res, next) => {
    if (!req.session) return res.sendStatus(204);
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('shiner.sid', { httpOnly: true, sameSite: 'strict', secure: req.secure });
      return res.sendStatus(204);
    });
  });

  router.get('/session', (req, res) => {
    if (!req.session?.adminId) return res.json({ authenticated: false });
    return res.json({ authenticated: true, email: req.session.adminEmail });
  });

  return router;
}

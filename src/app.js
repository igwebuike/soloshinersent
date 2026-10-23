import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuthRouter } from './auth/routes.js';
import { createSessionMiddleware } from './auth/session.js';
import { requireAdmin } from './auth/require-admin.js';
import { createProductRouter } from './products/routes.js';
import { errorHandler } from './errors.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminRoot = path.join(projectRoot, 'admin');
const siteRoot = projectRoot;

export function createApp({ pool, config, uploadDir, sessionStore } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(createSessionMiddleware({ pool, config, store: sessionStore }));

  app.use('/assets', express.static(path.join(siteRoot, 'assets'), { maxAge: '1d', fallthrough: false }));
  app.use('/uploads', express.static(uploadDir, {
    maxAge: '1d',
    fallthrough: false,
    setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
  }));

  app.get('/', (_req, res) => res.sendFile(path.join(siteRoot, 'index.html')));
  app.get('/public.js', (_req, res) => res.sendFile(path.join(siteRoot, 'public.js')));
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.get('/admin/login', (req, res) => {
    if (req.session?.adminId) return res.redirect('/admin');
    return res.sendFile(path.join(adminRoot, 'login.html'));
  });
  app.get('/admin/login.js', (_req, res) => res.sendFile(path.join(adminRoot, 'login.js')));
  app.get('/admin/admin.css', (_req, res) => res.sendFile(path.join(adminRoot, 'admin.css')));
  app.get('/admin/admin.js', (_req, res) => res.sendFile(path.join(adminRoot, 'admin.js')));
  app.get('/admin', (req, res) => {
    if (!req.session?.adminId) return res.redirect('/admin/login');
    return res.sendFile(path.join(adminRoot, 'index.html'));
  });

  app.use('/api/admin', createAuthRouter({ pool }));
  app.use('/api', createProductRouter({ pool, uploadDir }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'That request could not be found.' }));
  app.use(errorHandler);
  return app;
}

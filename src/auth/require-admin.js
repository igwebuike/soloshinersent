export function requireAdmin(req, res, next) {
  if (!req.session?.adminId) {
    return res.status(401).json({ error: 'Please sign in to manage products.' });
  }
  return next();
}

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'atletica-secret-2024';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.cargo !== 'admin') return res.status(403).json({ error: 'Acesso restrito' });
  next();
}

module.exports = { authMiddleware, adminOnly, JWT_SECRET };

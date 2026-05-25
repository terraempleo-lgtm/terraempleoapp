const jwt = require('jsonwebtoken');
require('dotenv').config();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
}

function empleadorMiddleware(req, res, next) {
  if (req.user.rol !== 'empleador' && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de empleador.' });
  }
  next();
}

function trabajadorMiddleware(req, res, next) {
  if (req.user.rol !== 'trabajador' && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de trabajador.' });
  }
  next();
}

function especialistaMiddleware(req, res, next) {
  if (req.user.rol !== 'especialista' && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de especialista.' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, empleadorMiddleware, trabajadorMiddleware, especialistaMiddleware };

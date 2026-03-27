const rateLimit = require('express-rate-limit');

// Limita intentos de autenticacion para reducir fuerza bruta.
const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesion. Intenta de nuevo en 15 minutos.' },
});

// Limita envio/verificacion de codigos para evitar abuso de OTP.
const authSmsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos con codigo SMS. Intenta de nuevo en 10 minutos.' },
});

// Limita recuperacion de contrasena para evitar enumeracion y abuso.
const authRecoveryLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperacion. Intenta de nuevo en 30 minutos.' },
});

module.exports = {
  authLoginLimiter,
  authSmsLimiter,
  authRecoveryLimiter,
};

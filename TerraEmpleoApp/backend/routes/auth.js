const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { authLoginLimiter, authSmsLimiter, authRecoveryLimiter } = require('../middleware/rateLimit');
const authController = require('../controllers/authController');
const { storage, storageHojasVida } = require('../config/s3');

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadHojaVida = multer({
  storage: storageHojasVida,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const esPdfMime = file.mimetype === 'application/pdf';
    const esPdfNombre = /\.pdf$/i.test(file.originalname || '');
    if (esPdfMime || esPdfNombre) return cb(null, true);
    return cb(new Error('Solo se permiten archivos PDF'));
  },
});

// Rutas públicas
router.post('/register', authLoginLimiter, authController.register);
router.post('/login', authLoginLimiter, authController.login);
router.post('/sms/enviar', authSmsLimiter, authController.enviarCodigoSMS);
router.post('/sms/verificar', authSmsLimiter, authController.verificarCodigoSMS);
router.post('/recuperar/solicitar', authRecoveryLimiter, authController.solicitarRecuperacion);
router.post('/recuperar/verificar', authRecoveryLimiter, authController.verificarCodigoRecuperacion);
router.post('/recuperar/nueva-password', authRecoveryLimiter, authController.actualizarPasswordRecuperacion);
router.post('/recuperar/solicitar-email', authRecoveryLimiter, authController.solicitarRecuperacionEmail);

// Rutas protegidas
router.get('/perfil', authMiddleware, authController.getPerfil);
router.put('/perfil', authMiddleware, authController.actualizarPerfil);
router.post('/fotos/:tipo', authMiddleware, upload.single('foto'), authController.subirFotos);
router.post('/cambiar-foto-perfil', authMiddleware, upload.single('foto'), authController.cambiarFotoPerfil);
router.post('/hoja-vida', authMiddleware, uploadHojaVida.single('hoja_vida'), authController.subirHojaVida);

module.exports = router;

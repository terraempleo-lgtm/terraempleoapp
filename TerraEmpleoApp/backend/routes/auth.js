const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const authController = require('../controllers/authController');
const { storage, storageHojasVida } = require('../config/cloudinary');

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
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/sms/enviar', authController.enviarCodigoSMS);
router.post('/sms/verificar', authController.verificarCodigoSMS);
router.post('/recuperar/solicitar', authController.solicitarRecuperacion);
router.post('/recuperar/verificar', authController.verificarCodigoRecuperacion);
router.post('/recuperar/nueva-password', authController.actualizarPasswordRecuperacion);

// Rutas protegidas
router.get('/perfil', authMiddleware, authController.getPerfil);
router.put('/perfil', authMiddleware, authController.actualizarPerfil);
router.post('/fotos/:tipo', authMiddleware, upload.single('foto'), authController.subirFotos);
router.post('/hoja-vida', authMiddleware, uploadHojaVida.single('hoja_vida'), authController.subirHojaVida);

module.exports = router;

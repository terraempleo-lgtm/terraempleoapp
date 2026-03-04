const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const authController = require('../controllers/authController');
const { storage } = require('../config/cloudinary');

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/sms/enviar', authController.enviarCodigoSMS);
router.post('/sms/verificar', authController.verificarCodigoSMS);

// Rutas protegidas
router.get('/perfil', authMiddleware, authController.getPerfil);
router.post('/fotos/:tipo', authMiddleware, upload.single('foto'), authController.subirFotos);

module.exports = router;

const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const authController = require('../controllers/authController');

// Configuración de multer para subida de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}_${req.params.tipo}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
  }
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

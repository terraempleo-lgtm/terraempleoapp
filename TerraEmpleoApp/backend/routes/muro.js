const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { storage } = require('../config/s3');
const muro = require('../controllers/muroController');

// Foto de la publicación (opcional, máx 10 MB, solo imágenes)
const uploadFoto = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

router.use(authMiddleware);

router.get('/', muro.listar);
router.post('/', uploadFoto.single('foto'), muro.crear);
router.put('/:id', muro.actualizar);
router.delete('/:id', muro.eliminar);
router.post('/:id/contactar', muro.contactar);

module.exports = router;

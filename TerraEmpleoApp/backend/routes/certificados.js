const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { listarCertificados, crearCertificado, eliminarCertificado } = require('../controllers/certificadosController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authMiddleware, listarCertificados);
router.get('/usuario/:usuario_id', authMiddleware, listarCertificados);
router.post('/', authMiddleware, upload.single('archivo'), crearCertificado);
router.delete('/:id', authMiddleware, eliminarCertificado);

module.exports = router;

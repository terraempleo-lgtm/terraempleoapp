const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware, especialistaMiddleware } = require('../middleware/auth');
const ctrl = require('../controllers/serviciosEspecialistaController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authMiddleware, ctrl.listarServicios);
router.get('/mis-servicios', authMiddleware, especialistaMiddleware, ctrl.misServicios);
router.get('/:id', authMiddleware, ctrl.detalleServicio);
router.post('/', authMiddleware, especialistaMiddleware, upload.array('fotos', 4), ctrl.crearServicio);
router.put('/:id', authMiddleware, especialistaMiddleware, ctrl.editarServicio);
router.delete('/:id', authMiddleware, especialistaMiddleware, ctrl.eliminarServicio);
router.post('/:id/fotos', authMiddleware, especialistaMiddleware, upload.single('foto'), ctrl.agregarFoto);
router.delete('/:id/fotos/:fotoId', authMiddleware, especialistaMiddleware, ctrl.eliminarFoto);

module.exports = router;

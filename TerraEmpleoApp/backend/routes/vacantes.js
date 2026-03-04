const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, empleadorMiddleware, trabajadorMiddleware } = require('../middleware/auth');
const vacantesController = require('../controllers/vacantesController');
const { storageVacantes } = require('../config/cloudinary');

const uploadVacantes = multer({
  storage: storageVacantes,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Rutas de empleador
router.post('/', authMiddleware, empleadorMiddleware, vacantesController.crearVacante);
router.get('/mis-vacantes', authMiddleware, empleadorMiddleware, vacantesController.misVacantes);
router.get('/postulaciones/:vacante_id', authMiddleware, empleadorMiddleware, vacantesController.verPostulaciones);
router.put('/postulaciones/:id/estado', authMiddleware, empleadorMiddleware, vacantesController.actualizarPostulacion);
router.put('/:id/cerrar', authMiddleware, empleadorMiddleware, vacantesController.cerrarVacante);
router.put('/:id', authMiddleware, empleadorMiddleware, vacantesController.actualizarVacante);
router.post('/:id/fotos', authMiddleware, empleadorMiddleware, uploadVacantes.array('fotos', 5), vacantesController.subirFotosVacante);
router.delete('/:id/fotos/:fotoId', authMiddleware, empleadorMiddleware, vacantesController.eliminarFotoVacante);

router.get('/:id/ejecutar-matching', authMiddleware, empleadorMiddleware, vacantesController.ejecutarMatchingEndpoint);

// Rutas de trabajador
router.get('/', authMiddleware, vacantesController.listarVacantes);
router.get('/:id', authMiddleware, vacantesController.detalleVacante);
router.post('/postularse', authMiddleware, trabajadorMiddleware, vacantesController.postularse);
router.get('/mis-postulaciones/lista', authMiddleware, trabajadorMiddleware, vacantesController.misPostulaciones);

module.exports = router;

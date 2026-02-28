const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware, trabajadorMiddleware } = require('../middleware/auth');
const vacantesController = require('../controllers/vacantesController');

// Rutas de empleador
router.post('/', authMiddleware, empleadorMiddleware, vacantesController.crearVacante);
router.get('/mis-vacantes', authMiddleware, empleadorMiddleware, vacantesController.misVacantes);
router.get('/postulaciones/:vacante_id', authMiddleware, empleadorMiddleware, vacantesController.verPostulaciones);
router.put('/postulaciones/:id/estado', authMiddleware, empleadorMiddleware, vacantesController.actualizarPostulacion);
router.put('/:id/cerrar', authMiddleware, empleadorMiddleware, vacantesController.cerrarVacante);

// Rutas de trabajador
router.get('/', authMiddleware, vacantesController.listarVacantes);
router.get('/:id', authMiddleware, vacantesController.detalleVacante);
router.post('/postularse', authMiddleware, trabajadorMiddleware, vacantesController.postularse);
router.get('/mis-postulaciones/lista', authMiddleware, trabajadorMiddleware, vacantesController.misPostulaciones);

module.exports = router;

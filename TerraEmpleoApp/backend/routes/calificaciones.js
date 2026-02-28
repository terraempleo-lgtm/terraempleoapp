const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const calificacionesController = require('../controllers/calificacionesController');

router.post('/', authMiddleware, calificacionesController.calificar);
router.get('/:usuario_id', authMiddleware, calificacionesController.obtenerCalificaciones);

module.exports = router;

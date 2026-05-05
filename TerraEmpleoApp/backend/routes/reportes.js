const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const reportesController = require('../controllers/reportesController');

router.post('/', authMiddleware, reportesController.crearReporte);
router.post('/bloquear', authMiddleware, reportesController.bloquearUsuario);
router.delete('/bloquear/:id', authMiddleware, reportesController.desbloquearUsuario);

module.exports = router;

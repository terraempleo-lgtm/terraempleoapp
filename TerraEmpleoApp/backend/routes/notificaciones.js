const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const ctrl = require('../controllers/notificacionesController');

router.get('/', authMiddleware, ctrl.listar);
router.get('/no-leidas', authMiddleware, ctrl.contarNoLeidas);
router.put('/leer-todas', authMiddleware, ctrl.marcarTodasLeidas);
router.put('/:id/leer', authMiddleware, ctrl.marcarLeida);

module.exports = router;

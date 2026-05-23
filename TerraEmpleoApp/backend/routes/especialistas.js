const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { listarEspecialistas, getPerfilEspecialista, contactarEspecialista } = require('../controllers/especialistaController');
const { empleadorMiddleware } = require('../middleware/auth');

// Rutas protegidas — solo usuarios autenticados (empleadores) pueden ver especialistas
router.get('/', authMiddleware, listarEspecialistas);
router.get('/:id', authMiddleware, getPerfilEspecialista);
router.post('/:id/contactar', authMiddleware, empleadorMiddleware, contactarEspecialista);

module.exports = router;

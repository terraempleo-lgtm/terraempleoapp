const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { listarEspecialistas, getPerfilEspecialista } = require('../controllers/especialistaController');

// Rutas protegidas — solo usuarios autenticados (empleadores) pueden ver especialistas
router.get('/', authMiddleware, listarEspecialistas);
router.get('/:id', authMiddleware, getPerfilEspecialista);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware } = require('../middleware/auth');
const { perfilPublicoTrabajador } = require('../controllers/vacantesController');

// GET /api/trabajadores/:id/perfil — perfil público de un trabajador (solo empleadores)
router.get('/:id/perfil', authMiddleware, empleadorMiddleware, perfilPublicoTrabajador);

module.exports = router;

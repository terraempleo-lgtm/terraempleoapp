const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware } = require('../middleware/auth');
const { perfilPublicoTrabajador } = require('../controllers/vacantesController');
const {
	listarTrabajadores,
	trabajadoresRecomendados,
	solicitarContacto,
} = require('../controllers/trabajadoresController');

// GET /api/trabajadores — listar trabajadores disponibles con match (solo empleadores)
router.get('/', authMiddleware, empleadorMiddleware, listarTrabajadores);

// GET /api/trabajadores/recomendados — trabajadores recomendados para una vacante/perfil de empleador
router.get('/recomendados', authMiddleware, empleadorMiddleware, trabajadoresRecomendados);

// POST /api/trabajadores/:id/contactar — enviar solicitud de contacto al trabajador
router.post('/:id/contactar', authMiddleware, empleadorMiddleware, solicitarContacto);

// GET /api/trabajadores/:id/perfil — perfil público de un trabajador (solo empleadores)
router.get('/:id/perfil', authMiddleware, empleadorMiddleware, perfilPublicoTrabajador);

module.exports = router;

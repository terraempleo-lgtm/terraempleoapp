const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware, especialistaMiddleware } = require('../middleware/auth');
const { listarEspecialistas, getPerfilEspecialista, contactarEspecialista, getContactoEstado, misSolicitudesContacto, responderSolicitudContacto } = require('../controllers/especialistaController');

router.get('/', authMiddleware, listarEspecialistas);
router.get('/mis-solicitudes', authMiddleware, especialistaMiddleware, misSolicitudesContacto);
router.put('/solicitudes/:id/responder', authMiddleware, especialistaMiddleware, responderSolicitudContacto);
router.get('/:id', authMiddleware, getPerfilEspecialista);
router.post('/:id/contactar', authMiddleware, empleadorMiddleware, contactarEspecialista);
router.get('/:id/contacto-estado', authMiddleware, empleadorMiddleware, getContactoEstado);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { misChats, getMensajes, enviarMensaje, marcarLeidos, contarNoLeidos } = require('../controllers/chatController');

router.use(authMiddleware);

router.get('/', misChats);
router.get('/no-leidos', contarNoLeidos);
router.get('/:id/mensajes', getMensajes);
router.post('/:id/mensajes', enviarMensaje);
router.put('/:id/mensajes/leer', marcarLeidos);

module.exports = router;

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { storageChat } = require('../config/s3');
const { misChats, getMensajes, enviarMensaje, enviarMedia, marcarLeidos, contarNoLeidos, obtenerChatPorVacanteTrabajador } = require('../controllers/chatController');

const uploadChat = multer({
  storage: storageChat,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/m4a', 'audio/webm', 'audio/ogg'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  },
});

router.use(authMiddleware);

router.get('/', misChats);
router.get('/no-leidos', contarNoLeidos);
router.get('/vacante/:vacanteId/trabajador/:trabajadorId', obtenerChatPorVacanteTrabajador);
router.get('/:id/mensajes', getMensajes);
router.post('/:id/mensajes', enviarMensaje);
router.post('/:id/mensajes/media', uploadChat.single('archivo'), enviarMedia);
router.put('/:id/mensajes/leer', marcarLeidos);

module.exports = router;

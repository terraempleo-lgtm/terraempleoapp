const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const tutorialesController = require('../controllers/tutorialesController');

// Estado "ya visto" de los tutoriales de primera vez, asociado al usuario
// autenticado (cualquier rol — el acceso a cada sección lo controla la
// navegación; aquí solo se persiste el estado).
router.use(authMiddleware);

router.get('/', tutorialesController.misTutoriales);
router.post('/:key/visto', tutorialesController.marcarVisto);

module.exports = router;

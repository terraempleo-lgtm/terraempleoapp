const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware } = require('../middleware/auth');
const cafe = require('../controllers/cafeController');

router.use(authMiddleware, empleadorMiddleware);

// Vista previa de conversión y panel de alertas
router.get('/preview', cafe.preview);
router.get('/alertas', cafe.alertas);

// Lotes
router.get('/lotes', cafe.listarLotes);
router.post('/lotes', cafe.crearLote);
router.get('/lotes/:id', cafe.detalleLote);
router.put('/lotes/:id', cafe.actualizarLote);
router.delete('/lotes/:id', cafe.eliminarLote);

// Producción real (báscula)
router.post('/lotes/:id/real', cafe.registrarReal);
router.delete('/real/:id', cafe.eliminarReal);

// Gestión de alerta del lote (justificar / cerrar) — propietario
router.put('/lotes/:id/alerta', cafe.gestionarAlerta);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware } = require('../middleware/auth');
const finca = require('../controllers/fincaController');
const herramientas = require('../controllers/herramientasController');
const balance = require('../controllers/balanceController');

// El módulo de finca es para empleadores (propietarios) y admin.
router.use(authMiddleware, empleadorMiddleware);

router.get('/mis-fincas', finca.misFincas);
router.post('/', finca.crearFinca);
router.get('/:id', finca.detalleFinca);
router.put('/:id', finca.actualizarFinca);

// Auditoría (solo propietario)
router.get('/:id/auditoria', finca.auditoria);

// Sub-usuarios de la finca
router.get('/:id/usuarios', finca.listarUsuarios);
router.post('/:id/usuarios', finca.invitarUsuario);
router.post('/:id/usuarios/crear-cuenta', finca.crearCuentaUsuario);
router.delete('/:id/usuarios/:fuId', finca.quitarUsuario);

// Lotes/parcelas de la finca
router.get('/:id/lotes/rendimiento', finca.listarRendimientoLotes);
router.get('/:id/lotes', finca.listarLotesFinca);
router.post('/:id/lotes', finca.crearLoteFinca);
router.delete('/:id/lotes/:loteId', finca.eliminarLoteFinca);

// Rendimiento por cultivo
router.get('/:id/cultivos/rendimiento', finca.listarRendimientoCultivos);

// Balance de la finca (Finanzas + Cuaderno + movimientos manuales de capital)
router.get('/:id/balance', balance.balance);
router.post('/:id/balance/movimientos', balance.crearMovimiento);
router.delete('/:id/balance/movimientos/:movId', balance.eliminarMovimiento);

// Herramientas, maquinaria y vehículos de la finca
router.get('/:id/herramientas', herramientas.listar);
router.post('/:id/herramientas', herramientas.crear);
router.put('/herramientas/:id', herramientas.actualizar);
router.delete('/herramientas/:id', herramientas.eliminar);
router.post('/herramientas/:id/mantenimientos', herramientas.crearMantenimiento);
router.delete('/herramientas/:id/mantenimientos/:mantenimientoId', herramientas.eliminarMantenimiento);

module.exports = router;

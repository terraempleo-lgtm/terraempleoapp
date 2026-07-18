const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware } = require('../middleware/auth');
const fin = require('../controllers/finanzasController');

router.use(authMiddleware, empleadorMiddleware);

// Tablero completo de un mes (período + semanas + conceptos + movimientos + resumen)
router.get('/tablero', fin.tablero);

// Movimientos (upsert por concepto + semana/período)
router.put('/movimientos', fin.upsertMovimiento);

// Conceptos (catálogo configurable)
router.post('/conceptos', fin.crearConcepto);
router.put('/conceptos/:id', fin.actualizarConcepto);
router.delete('/conceptos/:id', fin.eliminarConcepto);

// Cierre / reapertura de período
router.put('/periodos/:id/estado', fin.cambiarEstadoPeriodo);
router.put('/periodos/:id/precio-venta', fin.actualizarPrecioVenta);

module.exports = router;

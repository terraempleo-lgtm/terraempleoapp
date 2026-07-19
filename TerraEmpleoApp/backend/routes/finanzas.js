const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, empleadorMiddleware } = require('../middleware/auth');
const { storageFinanzas } = require('../config/s3');
const fin = require('../controllers/finanzasController');

// Foto adjunta a una factura (opcional, máx 10 MB, solo imágenes)
const uploadFotoFactura = multer({
  storage: storageFinanzas,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

router.use(authMiddleware, empleadorMiddleware);

// Tablero completo de un mes (período + semanas + conceptos + movimientos + resumen)
router.get('/tablero', fin.tablero);

// Movimientos (upsert por concepto + semana/período)
router.put('/movimientos', fin.upsertMovimiento);
router.post('/movimientos/:movimientoId/foto', uploadFotoFactura.single('foto'), fin.subirFotoMovimiento);
router.delete('/movimientos/:movimientoId/foto', fin.eliminarFotoMovimiento);

// Conceptos (catálogo configurable)
router.post('/conceptos', fin.crearConcepto);
router.put('/conceptos/:id', fin.actualizarConcepto);
router.delete('/conceptos/:id', fin.eliminarConcepto);

// Cierre / reapertura de período
router.put('/periodos/:id/estado', fin.cambiarEstadoPeriodo);
router.put('/periodos/:id/precio-venta', fin.actualizarPrecioVenta);

module.exports = router;

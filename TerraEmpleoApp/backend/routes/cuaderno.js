const express = require('express');
const router = express.Router();
const { authMiddleware, empleadorMiddleware } = require('../middleware/auth');
const cuaderno = require('../controllers/cuadernoController');
const nomina = require('../controllers/nominaController');

// Todas las rutas del cuaderno requieren rol empleador
router.use(authMiddleware, empleadorMiddleware);

// Dashboard + analítica
router.get('/dashboard', cuaderno.dashboard);

// Nómina semanal (planilla agregada por trabajador) — Fase 2
router.get('/nomina', nomina.planilla);
router.get('/nomina/nota', nomina.obtenerNotaNomina);
router.put('/nomina/nota', nomina.guardarNotaNomina);
router.post('/asistencias/:asisId/ajustes', nomina.agregarAjuste);
router.delete('/ajustes/:id', nomina.eliminarAjuste);
router.put('/asistencias/:asisId/firma', nomina.marcarFirma);

// Postulantes aceptados de una vacante (para preseleccionar al crear jornada)
router.get('/vacantes/:id/postulantes', cuaderno.postulantesVacante);

// Registro de trabajadores del empleador (registrados + externos de sus jornadas)
router.get('/mis-trabajadores', cuaderno.misTrabajadores);
router.post('/trabajadores-externos', cuaderno.crearTrabajadorExterno);

// Historial de un trabajador (filtrado al empleador actual)
router.get('/trabajadores/:id/historial', cuaderno.historialTrabajador);

// Jornadas
router.get('/jornadas', cuaderno.listarJornadas);
router.post('/jornadas', cuaderno.crearJornada);
router.get('/jornadas/:id', cuaderno.detalleJornada);
router.put('/jornadas/:id', cuaderno.actualizarJornada);
router.delete('/jornadas/:id', cuaderno.eliminarJornada);

// Asistencias (anidadas bajo jornada para create, sueltas para update/delete)
router.post('/jornadas/:id/asistencias', cuaderno.agregarAsistencia);
router.put('/asistencias/:asisId', cuaderno.actualizarAsistencia);
router.delete('/asistencias/:asisId', cuaderno.eliminarAsistencia);

// Registros de trabajo (upsert por asistencia)
router.put('/asistencias/:asisId/registro', cuaderno.upsertRegistroTrabajo);
router.put('/asistencias/:asisId/pago', cuaderno.marcarPagado);

// Calificaciones internas (privadas del empleador)
router.put('/asistencias/:asisId/calificacion', cuaderno.upsertCalificacion);

// Notas libres sobre trabajadores
router.post('/notas', cuaderno.crearNota);
router.delete('/notas/:id', cuaderno.eliminarNota);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(authMiddleware, adminMiddleware);

router.get('/dashboard', adminController.dashboard);
router.get('/usuarios', adminController.listarUsuarios);
router.get('/validaciones-identidad/pendientes', adminController.listarCedulasPendientes);
router.get('/usuarios/:id', adminController.getUsuarioDetalle);
router.get('/usuarios/:id/documentos-identidad', adminController.getDocumentosIdentidadUsuario);
router.put('/usuarios/:id/validacion-identidad', adminController.revisarValidacionIdentidadUsuario);
router.put('/usuarios/:id', adminController.actualizarUsuario);
router.put('/usuarios/:id/toggle', adminController.toggleUsuario);
router.delete('/usuarios/:id', adminController.eliminarUsuario);
router.get('/vacantes', adminController.listarTodasVacantes);
router.post('/vacantes', adminController.crearVacanteComoAdmin);
router.put('/vacantes/:id', adminController.actualizarVacante);
router.put('/vacantes/:id/estado', adminController.cambiarEstadoVacante);
router.delete('/vacantes/:id', adminController.eliminarVacante);
router.get('/vacantes/:vacante_id/postulaciones', adminController.verPostulacionesAdmin);
router.get('/empleadores', adminController.listarEmpleadores);
router.delete('/empleadores/:id', adminController.eliminarEmpleador);
router.get('/verificaciones-empresa/pendientes', adminController.listarEmpresasPendientes);
router.put('/empleadores/:id/verificacion-empresa', adminController.revisarVerificacionEmpresa);
router.get('/postulaciones', adminController.listarTodasPostulaciones);

// Reportes
const reportesController = require('../controllers/reportesController');
router.get('/reportes', reportesController.listarReportes);
router.put('/reportes/:id', reportesController.resolverReporte);

// PQRS
const pqrsController = require('../controllers/pqrsController');
router.get('/pqrs', pqrsController.listarPqrs);
router.put('/pqrs/:id', pqrsController.responderPqrs);

module.exports = router;

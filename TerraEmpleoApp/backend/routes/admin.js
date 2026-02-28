const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(authMiddleware, adminMiddleware);

router.get('/dashboard', adminController.dashboard);
router.get('/usuarios', adminController.listarUsuarios);
router.put('/usuarios/:id/toggle', adminController.toggleUsuario);
router.delete('/usuarios/:id', adminController.eliminarUsuario);
router.get('/vacantes', adminController.listarTodasVacantes);
router.delete('/vacantes/:id', adminController.eliminarVacante);
router.get('/postulaciones', adminController.listarTodasPostulaciones);

module.exports = router;

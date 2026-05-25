const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, empleadorMiddleware, trabajadorMiddleware } = require('../middleware/auth');
const vacantesController = require('../controllers/vacantesController');
const { storageVacantes } = require('../config/s3');

const uploadVacantes = multer({
  storage: storageVacantes,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Rutas de empleador
router.post('/', authMiddleware, empleadorMiddleware, vacantesController.crearVacante);
router.get('/mis-vacantes', authMiddleware, empleadorMiddleware, vacantesController.misVacantes);
router.get('/postulaciones/:vacante_id', authMiddleware, empleadorMiddleware, vacantesController.verPostulaciones);
router.put('/postulaciones/:id/estado', authMiddleware, empleadorMiddleware, vacantesController.actualizarPostulacion);
router.put('/:id/cerrar', authMiddleware, empleadorMiddleware, vacantesController.cerrarVacante);
router.delete('/:id', authMiddleware, empleadorMiddleware, vacantesController.eliminarVacante);
router.put('/:id', authMiddleware, empleadorMiddleware, vacantesController.actualizarVacante);
router.post('/:id/fotos', authMiddleware, (req, res, next) => {
  if (!['empleador', 'admin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de empleador o admin.' });
  }

  uploadVacantes.array('fotos', 5)(req, res, (err) => {
    if (err) {
      console.error('Multer/S3 error en fotos vacante:', err);
      return res.status(500).json({ error: 'Error al procesar la imagen: ' + err.message });
    }
    next();
  });
}, vacantesController.subirFotosVacante);
router.delete('/:id/fotos/:fotoId', authMiddleware, empleadorMiddleware, vacantesController.eliminarFotoVacante);

router.get('/:id/ejecutar-matching', authMiddleware, empleadorMiddleware, vacantesController.ejecutarMatchingEndpoint);

// Rutas de trabajador
router.get('/recomendadas', authMiddleware, vacantesController.vacantesRecomendadas);
router.put('/postulaciones/:id/responder-contacto', authMiddleware, trabajadorMiddleware, vacantesController.responderSolicitudContacto);
router.get('/', authMiddleware, vacantesController.listarVacantes);
router.get('/:id', authMiddleware, vacantesController.detalleVacante);
const trabajadorOEspecialistaMiddleware = (req, res, next) => {
  if (!['trabajador', 'especialista', 'admin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  next();
};
router.post('/postularse', authMiddleware, trabajadorOEspecialistaMiddleware, vacantesController.postularse);
router.get('/mis-postulaciones/lista', authMiddleware, trabajadorOEspecialistaMiddleware, vacantesController.misPostulaciones);

module.exports = router;

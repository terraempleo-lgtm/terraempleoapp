const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { crearPqrs, misPqrs, responderUsuarioPqrs } = require('../controllers/pqrsController');

router.use(authMiddleware);

router.post('/', crearPqrs);
router.get('/', misPqrs);
router.put('/:id/responder', responderUsuarioPqrs);

module.exports = router;

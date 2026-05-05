const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { crearPqrs, misPqrs } = require('../controllers/pqrsController');

router.use(authMiddleware);

router.post('/', crearPqrs);
router.get('/', misPqrs);

module.exports = router;

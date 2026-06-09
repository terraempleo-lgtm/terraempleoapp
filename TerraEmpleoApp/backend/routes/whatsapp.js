const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { recibirWebhook, verificarWebhook, estado } = require('../controllers/whatsappController');

// Webhook del proveedor (Evolution API / Cloud API). Sin auth JWT — lo llama el proveedor.
// Se protege opcionalmente con WHATSAPP_WEBHOOK_TOKEN (ver controller).
router.post('/webhooks/whatsapp', recibirWebhook);
router.get('/webhooks/whatsapp', verificarWebhook);

// Diagnóstico (solo admin).
router.get('/webhooks/whatsapp/estado', authMiddleware, adminMiddleware, estado);

module.exports = router;

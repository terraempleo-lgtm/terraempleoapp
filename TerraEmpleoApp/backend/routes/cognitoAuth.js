const express = require('express');
const router = express.Router();
const cognitoAuthController = require('../controllers/cognitoAuthController');
const passkeyController = require('../controllers/passkeyController');
const { authLoginLimiter, authSmsLimiter, authRecoveryLimiter } = require('../middleware/rateLimit');

// POST /api/auth/cognito/register
router.post('/register', authLoginLimiter, cognitoAuthController.register);

// POST /api/auth/cognito/confirm-register
router.post('/confirm-register', authSmsLimiter, cognitoAuthController.confirmRegister);

// POST /api/auth/cognito/resend-code
router.post('/resend-code', authSmsLimiter, cognitoAuthController.resendCode);

// POST /api/auth/cognito/login
router.post('/login', authLoginLimiter, cognitoAuthController.login);

// POST /api/auth/cognito/forgot-password
router.post('/forgot-password', authRecoveryLimiter, cognitoAuthController.forgotPassword);

// POST /api/auth/cognito/confirm-forgot-password
router.post('/confirm-forgot-password', authRecoveryLimiter, cognitoAuthController.confirmForgotPassword);


// ── Passkey / WebAuthn ────────────────────────────────────────────────────────
// Registro (requiere estar ya autenticado con Cognito — header x-cognito-token)
router.post('/passkey/register/start',  authLoginLimiter, passkeyController.startRegistration);
router.post('/passkey/register/finish', authLoginLimiter, passkeyController.finishRegistration);
// Autenticación (flujo independiente, sin JWT previo)
router.post('/passkey/auth/start',  authLoginLimiter, passkeyController.startAuthentication);
router.post('/passkey/auth/finish', authLoginLimiter, passkeyController.finishAuthentication);

module.exports = router;

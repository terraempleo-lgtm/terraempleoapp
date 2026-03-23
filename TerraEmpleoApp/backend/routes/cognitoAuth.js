const express = require('express');
const router = express.Router();
const cognitoAuthController = require('../controllers/cognitoAuthController');
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


module.exports = router;

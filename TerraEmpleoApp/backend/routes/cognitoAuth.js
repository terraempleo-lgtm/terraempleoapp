const express = require('express');
const router = express.Router();
const cognitoAuthController = require('../controllers/cognitoAuthController');

// POST /api/cognito/auth/register
router.post('/register', cognitoAuthController.register);

// POST /api/cognito/auth/confirm-register
router.post('/confirm-register', cognitoAuthController.confirmRegister);

// POST /api/cognito/auth/resend-code
router.post('/resend-code', cognitoAuthController.resendCode);

// POST /api/cognito/auth/login
router.post('/login', cognitoAuthController.login);

// POST /api/cognito/auth/forgot-password
router.post('/forgot-password', cognitoAuthController.forgotPassword);

// POST /api/cognito/auth/confirm-forgot-password
router.post('/confirm-forgot-password', cognitoAuthController.confirmForgotPassword);

module.exports = router;

const express = require('express');
const router = express.Router();
const cognitoAuthController = require('../controllers/cognitoAuthController');

// POST /api/auth/cognito/register
router.post('/register', cognitoAuthController.register);

// POST /api/auth/cognito/confirm-register
router.post('/confirm-register', cognitoAuthController.confirmRegister);

// POST /api/auth/cognito/resend-code
router.post('/resend-code', cognitoAuthController.resendCode);

// POST /api/auth/cognito/login
router.post('/login', cognitoAuthController.login);

// POST /api/auth/cognito/forgot-password
router.post('/forgot-password', cognitoAuthController.forgotPassword);

// POST /api/auth/cognito/confirm-forgot-password
router.post('/confirm-forgot-password', cognitoAuthController.confirmForgotPassword);

// POST /api/auth/cognito/admin-create-test-user  (testing only, blocked in production)
router.post('/admin-create-test-user', cognitoAuthController.createTestUser);

module.exports = router;

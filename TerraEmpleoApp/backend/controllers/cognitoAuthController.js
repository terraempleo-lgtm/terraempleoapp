const {
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const jwt = require('jsonwebtoken');
const { cognitoClient, COGNITO_CLIENT_ID } = require('../config/cognito');
const { normalizePhone } = require('../helpers/normalizePhone');
const { markPhoneVerified, findUserByNormalizedPhone } = require('../helpers/userSync');
const { signUrl } = require('../config/s3');
require('dotenv').config();

const toBool = (val) => Number(val) === 1;

// ─── Mapeo de errores de Cognito a mensajes en español ───────────────────────

const COGNITO_ERROR_MAP = {
  UsernameExistsException: {
    status: 409,
    message: 'Ya existe un usuario registrado con este número de teléfono.',
  },
  CodeMismatchException: {
    status: 400,
    message: 'El código de verificación es incorrecto.',
  },
  ExpiredCodeException: {
    status: 400,
    message: 'El código de verificación ha expirado. Solicita uno nuevo.',
  },
  UserNotConfirmedException: {
    status: 403,
    message: 'La cuenta no ha sido confirmada. Verifica tu código SMS.',
  },
  NotAuthorizedException: {
    status: 401,
    message: 'Credenciales incorrectas.',
  },
  UserNotFoundException: {
    status: 404,
    message: 'No se encontró un usuario con este número de teléfono.',
  },
  InvalidPasswordException: {
    status: 400,
    message: 'La contraseña no cumple con los requisitos mínimos de seguridad.',
  },
  LimitExceededException: {
    status: 429,
    message: 'Has excedido el límite de intentos. Espera unos minutos.',
  },
  TooManyRequestsException: {
    status: 429,
    message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  },
  InvalidParameterException: {
    status: 400,
    message: 'Uno o más parámetros son inválidos.',
  },
};

function handleCognitoError(err, res) {
  const errorName = err.name || err.__type;
  const mapped = COGNITO_ERROR_MAP[errorName];

  if (mapped) {
    return res.status(mapped.status).json({ ok: false, error: mapped.message });
  }

  console.error('[Cognito] Error no mapeado:', err);
  return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
}

// ─── 1) POST /api/auth/cognito/register ──────────────────────────────────────

async function register(req, res) {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ ok: false, error: 'phoneNumber y password son obligatorios.' });
    }

    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido. Usa formato colombiano (ej: 3001234567).' });
    }

    const command = new SignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: phone,
      Password: password,
      UserAttributes: [
        { Name: 'phone_number', Value: phone },
      ],
    });

    const result = await cognitoClient.send(command);

    return res.status(201).json({
      ok: true,
      message: 'Usuario registrado. Se envió un código de verificación por SMS.',
      userSub: result.UserSub,
      userConfirmed: result.UserConfirmed,
      codeDeliveryDetails: result.CodeDeliveryDetails || null,
    });
  } catch (err) {
    return handleCognitoError(err, res);
  }
}

// ─── 2) POST /api/auth/cognito/confirm-register ─────────────────────────────

async function confirmRegister(req, res) {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ ok: false, error: 'phoneNumber y code son obligatorios.' });
    }

    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new ConfirmSignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: phone,
      ConfirmationCode: code,
    });

    await cognitoClient.send(command);

    // Sincronizar con BD local: marcar verificado_sms = 1 si el usuario existe
    const synced = await markPhoneVerified(phoneNumber);
    if (synced) {
      console.log(`[Cognito] confirm-register: verificado_sms actualizado para ${phone}`);
    }

    return res.json({
      ok: true,
      message: 'Cuenta confirmada exitosamente.',
    });
  } catch (err) {
    return handleCognitoError(err, res);
  }
}

// ─── 3) POST /api/auth/cognito/resend-code ──────────────────────────────────

async function resendCode(req, res) {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ ok: false, error: 'phoneNumber es obligatorio.' });
    }

    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new ResendConfirmationCodeCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: phone,
    });

    const result = await cognitoClient.send(command);

    return res.json({
      ok: true,
      message: 'Código de verificación reenviado por SMS.',
      codeDeliveryDetails: result.CodeDeliveryDetails || null,
    });
  } catch (err) {
    return handleCognitoError(err, res);
  }
}

// ─── 4) POST /api/auth/cognito/login ────────────────────────────────────────
//
// Usa el flujo USER_PASSWORD_AUTH.
// IMPORTANTE: Este flujo debe estar habilitado en el App Client de Cognito.
//   Consola AWS → Cognito → User Pool → App integration → App client →
//   Auth flows → Marcar "ALLOW_USER_PASSWORD_AUTH"
//

async function login(req, res) {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ ok: false, error: 'phoneNumber y password son obligatorios.' });
    }

    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    // 1. Autenticar con Cognito
    const command = new InitiateAuthCommand({
      ClientId: COGNITO_CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: phone,
        PASSWORD: password,
      },
    });

    const result = await cognitoClient.send(command);
    const auth = result.AuthenticationResult;

    // 2. Buscar usuario en BD local por celular (normalizado + fallback legacy)
    const user = await findUserByNormalizedPhone(phoneNumber);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'Cuenta verificada en Cognito, pero falta completar el registro en la plataforma.',
        code: 'LOCAL_USER_NOT_FOUND',
      });
    }

    // 3. Generar JWT local (mantiene compatibilidad con el resto de la app)
    const token = jwt.sign(
      { id: user.id, rol: user.rol, celular: user.celular, nombre_completo: user.nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const fotoSelfie = user.foto_selfie ? await signUrl(user.foto_selfie) : null;

    return res.json({
      ok: true,
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        rol: user.rol,
        nombre_completo: user.nombre_completo,
        celular: user.celular,
        correo: user.correo,
        departamento: user.departamento,
        municipio: user.municipio,
        verificado_sms: toBool(user.verificado_sms),
        calificacion_promedio: user.calificacion_promedio,
        foto_selfie: fotoSelfie,
      },
      cognito: {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        tokenType: auth.TokenType,
      },
    });
  } catch (err) {
    return handleCognitoError(err, res);
  }
}

// ─── 5) POST /api/auth/cognito/forgot-password ──────────────────────────────

async function forgotPassword(req, res) {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ ok: false, error: 'phoneNumber es obligatorio.' });
    }

    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new ForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: phone,
    });

    const result = await cognitoClient.send(command);

    return res.json({
      ok: true,
      message: 'Se envió un código de verificación para restablecer la contraseña.',
      codeDeliveryDetails: result.CodeDeliveryDetails || null,
    });
  } catch (err) {
    return handleCognitoError(err, res);
  }
}

// ─── 6) POST /api/auth/cognito/confirm-forgot-password ──────────────────────

async function confirmForgotPassword(req, res) {
  try {
    const { phoneNumber, code, newPassword } = req.body;

    if (!phoneNumber || !code || !newPassword) {
      return res.status(400).json({ ok: false, error: 'phoneNumber, code y newPassword son obligatorios.' });
    }

    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new ConfirmForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: phone,
      ConfirmationCode: code,
      Password: newPassword,
    });

    await cognitoClient.send(command);

    return res.json({
      ok: true,
      message: 'Contraseña actualizada exitosamente.',
    });
  } catch (err) {
    return handleCognitoError(err, res);
  }
}

module.exports = {
  register,
  confirmRegister,
  resendCode,
  login,
  forgotPassword,
  confirmForgotPassword,
};

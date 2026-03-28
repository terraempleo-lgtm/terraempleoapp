const {
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const jwt = require('jsonwebtoken');
const { cognitoClient, COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } = require('../config/cognito');
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
// Cognito puede responder con:
//   a) AuthenticationResult → login exitoso, contiene tokens.
//   b) ChallengeName        → requiere acción adicional (NEW_PASSWORD_REQUIRED,
//                              SMS_MFA, SOFTWARE_TOKEN_MFA, etc.).
//

const CHALLENGE_MESSAGES = {
  NEW_PASSWORD_REQUIRED: 'Debes establecer una contraseña permanente antes de iniciar sesión.',
  SMS_MFA: 'Se envió un código MFA por SMS. Ingresa el código para continuar.',
  SOFTWARE_TOKEN_MFA: 'Ingresa el código de tu aplicación de autenticación (TOTP).',
};

async function login(req, res) {
  try {
    const { phoneNumber, celular, password } = req.body;
    const rawPhone = phoneNumber || celular;

    if (!rawPhone || !password) {
      return res.status(400).json({ ok: false, error: 'phoneNumber (o celular) y password son obligatorios.' });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido. Usa formato colombiano (ej: 3001234567).' });
    }

    console.log(`[Cognito Login] incoming: "${rawPhone}" → normalized: "${phone}"`);

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

    console.log(`[Cognito Login] phone=${phone} | challenge=${result.ChallengeName || 'none'} | hasAuth=${!!result.AuthenticationResult}`);

    // ── 2a. Cognito devolvió un challenge (no hay tokens todavía) ──
    if (result.ChallengeName) {
      const message = CHALLENGE_MESSAGES[result.ChallengeName]
        || `Se requiere un paso adicional: ${result.ChallengeName}`;

      return res.status(200).json({
        ok: false,
        challengeRequired: true,
        challengeName: result.ChallengeName,
        challengeParameters: result.ChallengeParameters || {},
        session: result.Session || null,
        message,
      });
    }

    // ── 2b. Sin AuthenticationResult y sin challenge → respuesta inesperada ──
    const auth = result.AuthenticationResult;
    if (!auth) {
      console.error('[Cognito Login] Respuesta inesperada: sin AuthenticationResult ni ChallengeName', JSON.stringify(result));
      return res.status(502).json({ ok: false, error: 'Respuesta inesperada del proveedor de autenticación.' });
    }

    // 3. Buscar usuario en BD local por celular (normalizado + fallback legacy)
    const user = await findUserByNormalizedPhone(rawPhone);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'Cuenta verificada en Cognito, pero falta completar el registro en la plataforma.',
        code: 'LOCAL_USER_NOT_FOUND',
      });
    }

    // 4. Generar JWT local (mantiene compatibilidad con el resto de la app)
    const token = jwt.sign(
      { id: user.id, rol: user.rol, celular: user.celular, nombre_completo: user.nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
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
    const { phone, phoneNumber, celular } = req.body;
    const rawPhone = phone || phoneNumber || celular;

    if (!rawPhone) {
      return res.status(400).json({ ok: false, error: 'phone es obligatorio.' });
    }

    const phoneE164 = normalizePhone(rawPhone);
    if (!phoneE164) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new ForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: phoneE164,
    });

    const result = await cognitoClient.send(command);

    return res.json({
      ok: true,
      message: 'Se envió un código de verificación para restablecer la contraseña.',
      codeDeliveryDetails: result.CodeDeliveryDetails || null,
    });
  } catch (err) {
    console.error('[Cognito ForgotPassword] Error exacto:', err);
    if (err && err.name && err.message) {
      console.error(`[Cognito ForgotPassword] ${err.name}: ${err.message}`);
    }
    return handleCognitoError(err, res);
  }
}

// ─── 6) POST /api/auth/cognito/confirm-forgot-password ──────────────────────

async function confirmForgotPassword(req, res) {
  try {
    const { phone, phoneNumber, celular, code, newPassword } = req.body;
    const rawPhone = phone || phoneNumber || celular;

    if (!rawPhone || !code || !newPassword) {
      return res.status(400).json({ ok: false, error: 'phone, code y newPassword son obligatorios.' });
    }

    const phoneE164 = normalizePhone(rawPhone);
    if (!phoneE164) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new ConfirmForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: phoneE164,
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

const {
  StartWebAuthnRegistrationCommand,
  CompleteWebAuthnRegistrationCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require('jsonwebtoken');
const { cognitoClient, COGNITO_CLIENT_ID } = require('../config/cognito');
const { normalizePhone } = require('../helpers/normalizePhone');
const { findUserByNormalizedPhone } = require('../helpers/userSync');
const { signUrl } = require('../config/s3');

const toBool = (val) => Number(val) === 1;

// ─── POST /api/auth/cognito/passkey/register/start ───────────────────────────
// Header: x-cognito-token: <cognitoAccessToken>   (no es el JWT de la app)
// Devuelve: credentialCreationOptions (PublicKeyCredentialCreationOptions)
async function startRegistration(req, res) {
  try {
    const accessToken = req.headers['x-cognito-token'];
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: 'x-cognito-token requerido.' });
    }

    const command = new StartWebAuthnRegistrationCommand({ AccessToken: accessToken });
    const result = await cognitoClient.send(command);

    return res.json({
      ok: true,
      credentialCreationOptions: result.CredentialCreationOptions,
    });
  } catch (err) {
    console.error('[Passkey] startRegistration:', err.name, err.message);
    if (err.name === 'NotAuthorizedException') {
      return res.status(401).json({ ok: false, error: 'Token de Cognito inválido o expirado.' });
    }
    if (err.name === 'ForbiddenException') {
      return res.status(403).json({ ok: false, error: 'WebAuthn no está habilitado en el User Pool.' });
    }
    return res.status(500).json({ ok: false, error: 'No se pudo iniciar el registro de passkey.' });
  }
}

// ─── POST /api/auth/cognito/passkey/register/finish ──────────────────────────
// Header: x-cognito-token: <cognitoAccessToken>
// Body:   { credential: PublicKeyCredential (JSON) }
async function finishRegistration(req, res) {
  try {
    const accessToken = req.headers['x-cognito-token'];
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: 'x-cognito-token requerido.' });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ ok: false, error: 'credential es obligatorio.' });
    }

    const command = new CompleteWebAuthnRegistrationCommand({
      AccessToken: accessToken,
      Credential: JSON.stringify(credential),
    });

    await cognitoClient.send(command);

    return res.json({ ok: true, message: 'Passkey registrada exitosamente.' });
  } catch (err) {
    console.error('[Passkey] finishRegistration:', err.name, err.message);
    if (err.name === 'NotAuthorizedException') {
      return res.status(401).json({ ok: false, error: 'Token expirado. Inicia sesión nuevamente.' });
    }
    if (err.name === 'WebAuthnChallengeNotFoundException') {
      return res.status(400).json({ ok: false, error: 'Sesión de registro expirada. Intenta de nuevo.' });
    }
    return res.status(500).json({ ok: false, error: 'No se pudo completar el registro de passkey.' });
  }
}

// ─── POST /api/auth/cognito/passkey/auth/start ───────────────────────────────
// Body: { phoneNumber }
// Devuelve: { session, credentialRequestOptions, username }
async function startAuthentication(req, res) {
  try {
    const { phoneNumber, celular } = req.body;
    const rawPhone = phoneNumber || celular;

    if (!rawPhone) {
      return res.status(400).json({ ok: false, error: 'phoneNumber es obligatorio.' });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new InitiateAuthCommand({
      ClientId: COGNITO_CLIENT_ID,
      AuthFlow: 'USER_AUTH',
      AuthParameters: {
        USERNAME: phone,
        PREFERRED_CHALLENGE: 'WEB_AUTHN',
      },
    });

    const result = await cognitoClient.send(command);

    // Cognito puede responder con SELECT_CHALLENGE si el usuario tiene múltiples métodos
    if (result.ChallengeName === 'SELECT_CHALLENGE') {
      const available = result.ChallengeParameters?.AVAILABLE_CHALLENGES?.split(',') || [];
      if (!available.includes('WEB_AUTHN')) {
        return res.status(400).json({
          ok: false,
          error: 'Este usuario no tiene passkey registrada.',
          fallback: 'password',
        });
      }
      // Responder eligiendo WEB_AUTHN
      const selectCmd = new RespondToAuthChallengeCommand({
        ClientId: COGNITO_CLIENT_ID,
        ChallengeName: 'SELECT_CHALLENGE',
        Session: result.Session,
        ChallengeResponses: {
          USERNAME: phone,
          ANSWER: 'WEB_AUTHN',
        },
      });
      const selectResult = await cognitoClient.send(selectCmd);
      return res.json({
        ok: true,
        session: selectResult.Session,
        credentialRequestOptions: JSON.parse(
          selectResult.ChallengeParameters?.CREDENTIAL_REQUEST_OPTIONS || '{}'
        ),
        username: phone,
      });
    }

    if (result.ChallengeName !== 'WEB_AUTHN') {
      return res.status(400).json({
        ok: false,
        error: 'Este usuario no tiene passkey registrada.',
        challengeName: result.ChallengeName,
        fallback: 'password',
      });
    }

    return res.json({
      ok: true,
      session: result.Session,
      credentialRequestOptions: JSON.parse(
        result.ChallengeParameters?.CREDENTIAL_REQUEST_OPTIONS || '{}'
      ),
      username: phone,
    });
  } catch (err) {
    console.error('[Passkey] startAuthentication:', err.name, err.message);
    if (err.name === 'UserNotFoundException') {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.', fallback: 'password' });
    }
    if (err.name === 'NotAuthorizedException') {
      return res.status(400).json({ ok: false, error: 'Este usuario no tiene passkey registrada.', fallback: 'password' });
    }
    return res.status(500).json({ ok: false, error: 'No se pudo iniciar la autenticación con passkey.' });
  }
}

// ─── POST /api/auth/cognito/passkey/auth/finish ──────────────────────────────
// Body: { session, credential, phoneNumber }
async function finishAuthentication(req, res) {
  try {
    const { session, credential, phoneNumber, celular } = req.body;
    const rawPhone = phoneNumber || celular;

    if (!session || !credential || !rawPhone) {
      return res.status(400).json({ ok: false, error: 'session, credential y phoneNumber son obligatorios.' });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido.' });
    }

    const command = new RespondToAuthChallengeCommand({
      ClientId: COGNITO_CLIENT_ID,
      ChallengeName: 'WEB_AUTHN',
      Session: session,
      ChallengeResponses: {
        USERNAME: phone,
        CREDENTIAL: JSON.stringify(credential),
      },
    });

    const result = await cognitoClient.send(command);

    const auth = result.AuthenticationResult;
    if (!auth) {
      return res.status(401).json({ ok: false, error: 'Autenticación con passkey fallida.' });
    }

    const user = await findUserByNormalizedPhone(rawPhone);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado en la plataforma.' });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, celular: user.celular, nombre_completo: user.nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
    );

    const fotoSelfie = user.foto_selfie ? await signUrl(user.foto_selfie) : null;

    return res.json({
      ok: true,
      message: 'Inicio de sesión con passkey exitoso.',
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
      },
    });
  } catch (err) {
    console.error('[Passkey] finishAuthentication:', err.name, err.message);
    if (err.name === 'NotAuthorizedException' || err.name === 'WebAuthnCredentialNotFoundException') {
      return res.status(401).json({ ok: false, error: 'Passkey inválida o no reconocida.', fallback: 'password' });
    }
    if (err.name === 'WebAuthnChallengeNotFoundException') {
      return res.status(400).json({ ok: false, error: 'La sesión expiró. Intenta de nuevo.', fallback: 'password' });
    }
    return res.status(500).json({ ok: false, error: 'No se pudo completar la autenticación con passkey.' });
  }
}

module.exports = { startRegistration, finishRegistration, startAuthentication, finishAuthentication };

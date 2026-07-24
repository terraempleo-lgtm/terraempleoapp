const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { loadSecretsFromSSM } = require('./config/secrets');
const { initializeDatabase } = require('./models/schema');
const authRoutes = require('./routes/auth');
const vacantesRoutes = require('./routes/vacantes');
const calificacionesRoutes = require('./routes/calificaciones');
const adminRoutes = require('./routes/admin');
const trabajadoresRoutes = require('./routes/trabajadores');
const notificacionesRoutes = require('./routes/notificaciones');
const chatsRoutes = require('./routes/chats');
const cognitoAuthRoutes = require('./routes/cognitoAuth');
const reportesRoutes = require('./routes/reportes');
const pqrsRoutes = require('./routes/pqrs');
const especialistasRoutes = require('./routes/especialistas');
const empleadoresRoutes = require('./routes/empleadores');
const certificadosRoutes = require('./routes/certificados');
const serviciosEspecialistaRoutes = require('./routes/serviciosEspecialista');
const cuadernoRoutes = require('./routes/cuaderno');
const fincaRoutes = require('./routes/finca');
const finanzasRoutes = require('./routes/finanzas');
const cafeRoutes = require('./routes/cafe');
const muroRoutes = require('./routes/muro');
const whatsappRoutes = require('./routes/whatsapp');
const { initWhatsappSchema } = require('./models/whatsappSchema');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy — necesario detrás de Nginx/ALB para que req.ip sea real
app.set('trust proxy', 1);

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const allowedOrigins = [
  'https://app.terrampleo.com',
  'https://api.terrampleo.com',
  'https://www.terraempleo.com.co',
  'https://terraempleo.com.co',
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/10\.0\.2\.2(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
];
app.use(cors({
  origin: (origin, callback) => {
    // Sin origin = app móvil nativa, Postman, curl → permitir
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    if (allowed) return callback(null, true);
    callback(new Error(`CORS: origen no permitido — ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/vacantes', vacantesRoutes);
app.use('/api/calificaciones', calificacionesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trabajadores', trabajadoresRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/auth/cognito', cognitoAuthRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/pqrs', pqrsRoutes);
app.use('/api/especialistas', especialistasRoutes);
app.use('/api/empleadores', empleadoresRoutes);
app.use('/api/certificados', certificadosRoutes);
app.use('/api/servicios-especialista', serviciosEspecialistaRoutes);
app.use('/api/cuaderno', cuadernoRoutes);
app.use('/api/finca', fincaRoutes);
app.use('/api/finanzas', finanzasRoutes);
app.use('/api/cafe', cafeRoutes);
app.use('/api/muro', muroRoutes);
// Módulo WhatsApp: define rutas bajo /api/webhooks/whatsapp
app.use('/api', whatsappRoutes);

// Endpoint base de API para diagnóstico rápido
app.get('/api', (req, res) => {
  res.json({
    message: 'TerraEmpleo API funcionando',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/vacantes',
      '/api/calificaciones',
      '/api/trabajadores',
      '/api/notificaciones',
      '/api/chats',
      '/api/admin',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Health check — con verificación de conectividad a BD
app.get('/api/health', async (req, res) => {
  const { testConnection } = require('./config/database');
  const dbOk = await testConnection();
  const status = dbOk ? 'OK' : 'DEGRADED';
  const httpCode = dbOk ? 200 : 503;
  res.status(httpCode).json({
    status,
    message: 'TerraEmpleo API funcionando',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  // Garantizar headers CORS incluso en respuestas de error
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

// Reactivar vacantes que fueron cerradas automáticamente por fecha
const { query: dbQuery } = require('./config/database');
async function reactivarVacantes() {
  try {
    // NO reabrir las vacantes que el bot cerró intencionalmente (LLENA por WhatsApp):
    // esas quedan con whatsapp_seguimiento_detenido=1. 'cancelada'/'inactiva' tampoco se tocan.
    const result = await dbQuery(
      "UPDATE vacantes SET estado = 'activa' WHERE estado = 'cerrada' AND eliminado = 0 AND (whatsapp_seguimiento_detenido IS NULL OR whatsapp_seguimiento_detenido = 0)"
    );
    if (result.affectedRows > 0) {
      console.log(`[REACTIVAR] ${result.affectedRows} vacante(s) reactivada(s).`);
    }
  } catch (err) {
    console.error('[REACTIVAR] Error reactivando vacantes:', err.message);
  }
}

// Seguimiento SEMANAL al empleador (doc de Vero). Tick cada 1 h. Tres acciones:
//  1) Lunes 8am Colombia → mensaje LLENA/SIGUE/CANCELAR por cada vacante activa ≥7 días.
//  2) Recordatorio a las 24h si no respondió (una vez por ciclo).
//  3) Expiración: 4 ciclos sin respuesta → estado 'inactiva' + REACTIVAR.
// Solo a empleadores con opt-in. Las respuestas (LLENA/SIGUE/CANCELAR/VER) se manejan en conversationEngine.
async function seguimientoEmpleadores() {
  try {
    const wa = require('./services/whatsappService');
    const enviar = async (empleadorId, texto) => {
      const u = await dbQuery('SELECT whatsapp_opt_in FROM usuarios WHERE id = ?', [empleadorId]).catch(() => []);
      if (!u || !u[0] || !u[0].whatsapp_opt_in) return;
      const destino = await wa.mejorDestino(empleadorId);
      if (destino) await wa.enviarTexto(destino, texto, { usuarioId: empleadorId }).catch(() => {});
    };
    const ahoraCo = new Date(Date.now() - 5 * 3600 * 1000); // hora local Colombia
    const esLunes8 = ahoraCo.getUTCDay() === 1 && ahoraCo.getUTCHours() === 8;

    // 3) Expiración por 4 ciclos sin respuesta (antes del envío para no re-contar el de hoy).
    const expiradas = await dbQuery(`
      SELECT id, titulo, empleador_id FROM vacantes
      WHERE estado = 'activa' AND (eliminado IS NULL OR eliminado = 0)
        AND (seguimiento_respondido IS NULL OR seguimiento_respondido = 0)
        AND whatsapp_seguimiento_count >= 4
      LIMIT 20
    `).catch(() => []);
    for (const v of (expiradas || [])) {
      await dbQuery("UPDATE vacantes SET estado = 'inactiva' WHERE id = ?", [v.id]).catch(() => {});
      await enviar(v.empleador_id,
        `⏸️ Tu vacante *${v.titulo}* lleva 4 semanas sin actividad y la pausamos automáticamente.\n\n` +
        `Escribe *REACTIVAR* si sigues necesitando personal. 🌱`);
    }

    // 2) Recordatorio a las 24h del envío si no respondió (una vez por ciclo).
    const recordar = await dbQuery(`
      SELECT id, titulo, empleador_id FROM vacantes
      WHERE estado = 'activa' AND (eliminado IS NULL OR eliminado = 0)
        AND (seguimiento_respondido IS NULL OR seguimiento_respondido = 0)
        AND seguimiento_recordatorio_at IS NULL
        AND whatsapp_seguimiento_at IS NOT NULL
        AND whatsapp_seguimiento_at <= (NOW() - INTERVAL 24 HOUR)
      LIMIT 20
    `).catch(() => []);
    for (const v of (recordar || [])) {
      await dbQuery('UPDATE vacantes SET seguimiento_recordatorio_at = NOW() WHERE id = ?', [v.id]).catch(() => {});
      await enviar(v.empleador_id,
        `🔔 Recordatorio — tu vacante de *${v.titulo}* sigue activa en TerraEmpleo.\n\n` +
        `Tienes trabajadores esperando tu respuesta. Escribe *VER* para revisarlos o *CANCELAR* si ya no la necesitas.`);
    }

    // 1) Envío del lunes 8am (por cada vacante activa ≥7 días que no se le escribió esta semana).
    if (esLunes8) {
      const vacs = await dbQuery(`
        SELECT v.id, v.titulo, v.empleador_id, v.municipio, v.departamento, v.vereda,
          DATEDIFF(NOW(), v.created_at) AS dias,
          (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) AS postulados
        FROM vacantes v
        WHERE v.estado = 'activa' AND (v.eliminado IS NULL OR v.eliminado = 0)
          AND v.created_at <= (NOW() - INTERVAL 7 DAY)
          AND (v.whatsapp_seguimiento_at IS NULL OR v.whatsapp_seguimiento_at <= (NOW() - INTERVAL 6 DAY))
        LIMIT 50
      `).catch(() => []);
      for (const v of (vacs || [])) {
        const lugar = [v.vereda, v.municipio, v.departamento].filter(Boolean).join(', ') || 'tu finca';
        const n = Number(v.postulados || 0);
        await enviar(v.empleador_id,
          `🌱 *TerraEmpleo* — Seguimiento de tu vacante\n\n` +
          `Tienes una vacante activa:\n👷 *${v.titulo}*\n📍 ${lugar}\n📅 Publicada hace ${Number(v.dias || 0)} días\n👥 Postulantes recibidos: ${n}\n\n` +
          `¿Ya encontraste a alguien para esta vacante?\n` +
          `1️⃣ Escribe *LLENA* si ya contrataste\n` +
          `2️⃣ Escribe *SIGUE* si sigues buscando\n` +
          `3️⃣ Escribe *CANCELAR* si ya no la necesitas`);
        await dbQuery(
          'UPDATE vacantes SET whatsapp_seguimiento_at = NOW(), whatsapp_seguimiento_count = COALESCE(whatsapp_seguimiento_count, 0) + 1, seguimiento_respondido = 0, seguimiento_recordatorio_at = NULL WHERE id = ?',
          [v.id]
        ).catch(() => {});
      }
      if (vacs && vacs.length) console.log(`[SEGUIMIENTO] lunes: ${vacs.length} vacante(s).`);
    }
  } catch (err) {
    console.error('[SEGUIMIENTO] error:', err.message);
  }
}

// Recordatorio matutino de asistencia (PASO 5 / Disparador 4): la mañana de la jornada, a las
// 5:30am (Colombia), a los trabajadores aceptados que NO confirmaron les pregunta VOY / NO VOY.
// Disparador 5: si a las 6:00am siguen sin confirmar, alerta de riesgo de no-show al operador
// Terra (admins) y al empleador. Corre cada 15 min pero cada bloque se auto-gatea por hora.
async function recordatorioAsistencia() {
  try {
    const ahoraCo = new Date(Date.now() - 5 * 3600 * 1000);
    const horaCo = ahoraCo.getUTCHours();
    const minCo = ahoraCo.getUTCMinutes();
    if (horaCo < 5 || horaCo > 9) return; // solo en la mañana
    const hoyCo = ahoraCo.toISOString().slice(0, 10); // "hoy" en Colombia (YYYY-MM-DD)
    const wa = require('./services/whatsappService');

    // 1) Recordatorio VOY / NO VOY — se dispara a partir de las 5:30am (una vez por postulación).
    if (horaCo > 5 || minCo >= 30) {
      const posts = await dbQuery(`
        SELECT p.id, p.trabajador_id, v.titulo, v.municipio, v.departamento, v.hora_jornada
        FROM postulaciones p
        JOIN vacantes v ON v.id = p.vacante_id
        WHERE p.estado = 'aceptada'
          AND (p.asistencia_confirmada IS NULL OR p.asistencia_confirmada = 0)
          AND (p.no_asistira IS NULL OR p.no_asistira = 0)
          AND p.recordatorio_voy_at IS NULL
          AND v.fecha_jornada = ?
          AND v.estado = 'activa' AND (v.eliminado IS NULL OR v.eliminado = 0)
        LIMIT 50
      `, [hoyCo]).catch(() => []);
      for (const p of (posts || [])) {
        const u = await dbQuery('SELECT nombre_completo, whatsapp_opt_in FROM usuarios WHERE id = ?', [p.trabajador_id]).catch(() => []);
        if (u && u[0] && u[0].whatsapp_opt_in) {
          const destino = await wa.mejorDestino(p.trabajador_id);
          if (destino) {
            const nombre = (u[0].nombre_completo || '').split(' ')[0] || '';
            const lugar = [p.municipio, p.departamento].filter(Boolean).join(', ') || '';
            const hora = p.hora_jornada ? ` a las *${p.hora_jornada}*` : '';
            const txt =
              `⏰ Buenos días ${nombre}. Hoy es tu jornada en *${p.titulo}*` +
              `${lugar ? ` (${lugar})` : ''}${hora}.\n\n` +
              `¿Vas a poder asistir?\n• Responde *VOY*\n• Responde *NO VOY* si no puedes.`;
            await wa.enviarTexto(destino, txt, { usuarioId: p.trabajador_id }).catch(() => {});
          }
        }
        await dbQuery('UPDATE postulaciones SET recordatorio_voy_at = NOW() WHERE id = ?', [p.id]).catch(() => {});
      }
      if (posts && posts.length) console.log(`[RECORDATORIO] ${posts.length} recordatorio(s) de asistencia enviados.`);
    }

    // 2) Alerta de no-show — a partir de las 6:00am, los que siguen sin confirmar ni decir NO VOY
    //    se reportan al operador Terra (admins, notificación in-app) y al empleador (WhatsApp).
    if (horaCo >= 6) {
      const riesgo = await dbQuery(`
        SELECT p.id, p.trabajador_id, v.titulo, v.empleador_id, v.municipio, v.departamento
        FROM postulaciones p
        JOIN vacantes v ON v.id = p.vacante_id
        WHERE p.estado = 'aceptada'
          AND (p.asistencia_confirmada IS NULL OR p.asistencia_confirmada = 0)
          AND (p.no_asistira IS NULL OR p.no_asistira = 0)
          AND p.alerta_noshow_at IS NULL
          AND v.fecha_jornada = ?
          AND v.estado = 'activa' AND (v.eliminado IS NULL OR v.eliminado = 0)
        LIMIT 50
      `, [hoyCo]).catch(() => []);
      if (riesgo && riesgo.length) {
        const { crearNotificacion } = require('./controllers/notificacionesController');
        const admins = await dbQuery("SELECT id FROM usuarios WHERE rol = 'admin' AND activo = 1").catch(() => []);
        for (const p of riesgo) {
          const t = await dbQuery('SELECT nombre_completo FROM usuarios WHERE id = ?', [p.trabajador_id]).catch(() => []);
          const nombreTrab = (t && t[0] && t[0].nombre_completo) || 'Un trabajador';
          const lugar = [p.municipio, p.departamento].filter(Boolean).join(', ') || '';
          // Operador Terra (admins) — notificación in-app.
          for (const a of (admins || [])) {
            await crearNotificacion(
              a.id, 'riesgo_noshow', '⚠️ Riesgo de no-show',
              `${nombreTrab} no ha confirmado asistencia a "${p.titulo}"${lugar ? ` (${lugar})` : ''} y hoy es la jornada.`,
              { vacante_id: p.vacante_id, postulacion_id: p.id }
            ).catch(() => {});
          }
          // Empleador — aviso por WhatsApp para que consiga reemplazo.
          const e = await dbQuery('SELECT whatsapp_opt_in FROM usuarios WHERE id = ?', [p.empleador_id]).catch(() => []);
          if (e && e[0] && e[0].whatsapp_opt_in) {
            const destino = await wa.mejorDestino(p.empleador_id);
            if (destino) {
              await wa.enviarTexto(destino,
                `⚠️ *Aviso TerraEmpleo* — ${nombreTrab.split(' ')[0]} aún no confirma asistencia a tu vacante *${p.titulo}* ` +
                `y hoy es la jornada.\n\nTe recomendamos tener un reemplazo listo por si no se presenta. 🌱`,
                { usuarioId: p.empleador_id }).catch(() => {});
            }
          }
          await dbQuery('UPDATE postulaciones SET alerta_noshow_at = NOW() WHERE id = ?', [p.id]).catch(() => {});
        }
        console.log(`[NO-SHOW] ${riesgo.length} alerta(s) de riesgo enviadas.`);
      }
    }
  } catch (err) {
    console.error('[RECORDATORIO] error:', err.message);
  }
}

// Reenvío de la oferta de vacante (Disparador 2): si el trabajador con match_auto no respondió
// SÍ/NO en 2h, se le reenvía la oferta una sola vez. Corre cada 30 min.
async function recordatorioOferta() {
  try {
    const pend = await dbQuery(`
      SELECT p.id, p.trabajador_id, p.puntaje_match,
             v.id AS vacante_id, v.titulo, v.municipio, v.departamento, v.monto_pago,
             v.fecha_jornada, v.hora_jornada, v.cupos
      FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      WHERE p.estado = 'match_auto'
        AND p.oferta_recordatorio_at IS NULL
        AND p.created_at <= (NOW() - INTERVAL 2 HOUR)
        AND v.estado = 'activa' AND (v.eliminado IS NULL OR v.eliminado = 0)
      LIMIT 50
    `).catch(() => []);
    if (!pend || pend.length === 0) return;

    const wa = require('./services/whatsappService');
    for (const p of pend) {
      const vacante = {
        id: p.vacante_id, titulo: p.titulo, municipio: p.municipio, departamento: p.departamento,
        monto_pago: p.monto_pago, fecha_jornada: p.fecha_jornada, hora_jornada: p.hora_jornada, cupos: p.cupos
      };
      await wa.enviarVacanteAMatch(p.trabajador_id, vacante, p.puntaje_match).catch(() => ({}));
      await dbQuery('UPDATE postulaciones SET oferta_recordatorio_at = NOW() WHERE id = ?', [p.id]).catch(() => {});
    }
    console.log(`[OFERTA-2H] ${pend.length} oferta(s) reenviada(s).`);
  } catch (err) {
    console.error('[OFERTA-2H] error:', err.message);
  }
}

// Barrido de la lista de espera: caduca las ofertas de cupo liberado que superaron la ventana
// de 30 min sin respuesta (el trabajador pierde el turno) y promueve al siguiente en la lista.
async function barrerListaEspera() {
  try {
    const vencidas = await dbQuery(`
      SELECT id, vacante_id FROM postulaciones
      WHERE en_lista_espera = 1 AND espera_ofrecida_at IS NOT NULL
        AND espera_ofrecida_at < (NOW() - INTERVAL 30 MINUTE)
      LIMIT 50
    `).catch(() => []);
    if (!vencidas || vencidas.length === 0) return;
    const { promoverListaEspera } = require('./controllers/vacantesController');
    const vacantes = new Set();
    for (const v of vencidas) {
      await dbQuery('UPDATE postulaciones SET en_lista_espera = 0, espera_ofrecida_at = NULL WHERE id = ?', [v.id]).catch(() => {});
      vacantes.add(v.vacante_id);
    }
    for (const vacanteId of vacantes) {
      await promoverListaEspera(vacanteId).catch(() => {});
    }
    console.log(`[LISTA_ESPERA] ${vencidas.length} oferta(s) vencida(s) barrida(s).`);
  } catch (err) {
    console.error('[LISTA_ESPERA] error:', err.message);
  }
}

// Validar variables de entorno críticas al arrancar
function validateEnv() {
  const required = ['JWT_SECRET', 'COGNITO_REGION', 'COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[INIT] ERROR: Variables de entorno requeridas no configuradas: ${missing.join(', ')}`);
    process.exit(1);
  }
  const jwtSecret = process.env.JWT_SECRET || '';
  if (process.env.NODE_ENV === 'production' && jwtSecret.length < 32) {
    console.error('[INIT] ERROR: JWT_SECRET es demasiado corto para producción (mínimo 32 caracteres).');
    process.exit(1);
  }
}

// Iniciar servidor
async function startServer() {
  // Cargar secretos desde SSM antes de validar variables de entorno
  await loadSecretsFromSSM();
  validateEnv();

  try {
    await initializeDatabase();
    await initWhatsappSchema();
    console.log('[INIT] Base de datos inicializada correctamente');
  } catch (err) {
    console.error('[INIT] Error inicializando base de datos:', err.code || '', err.message);
    console.error('[INIT] El servidor arrancará sin garantías de schema. Verifica la conexión a la BD.');
  }

  // Reactivar vacantes cerradas automáticamente
  await reactivarVacantes();

  // Seguimiento a empleadores (LLENA/SIGUE/CANCELAR): corrida a los 2 min y luego cada 1 h
  // (el envío del lunes 8am, el recordatorio 24h y la expiración se auto-gatean por hora/fecha).
  setTimeout(() => seguimientoEmpleadores(), 2 * 60 * 1000);
  setInterval(() => seguimientoEmpleadores(), 60 * 60 * 1000);

  // Recordatorio matutino de asistencia (VOY/NO VOY a las 5:30am) + alerta de no-show a las 6am:
  // corrida a los 3 min y luego cada 15 min (los bloques se auto-gatean por hora Colombia).
  setTimeout(() => recordatorioAsistencia(), 3 * 60 * 1000);
  setInterval(() => recordatorioAsistencia(), 15 * 60 * 1000);

  // Reenvío de la oferta de vacante a las 2h sin respuesta (una vez): corrida a los 4 min y cada 30 min.
  setTimeout(() => recordatorioOferta(), 4 * 60 * 1000);
  setInterval(() => recordatorioOferta(), 30 * 60 * 1000);

  // Barrido de la lista de espera (ofertas de cupo vencidas): cada 10 min.
  setInterval(() => barrerListaEspera(), 10 * 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌿 TerraEmpleo API corriendo en http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);
    console.log('Cognito SMS verification ready');
  });
}

startServer();

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
    const result = await dbQuery(
      "UPDATE vacantes SET estado = 'activa' WHERE estado = 'cerrada' AND eliminado = 0"
    );
    if (result.affectedRows > 0) {
      console.log(`[REACTIVAR] ${result.affectedRows} vacante(s) reactivada(s).`);
    }
  } catch (err) {
    console.error('[REACTIVAR] Error reactivando vacantes:', err.message);
  }
}

// Seguimiento SEMANAL por WhatsApp a empleadores con vacantes activas: pregunta si ya
// contrató a alguien. Recurrente cada 7 días, con tope de 4 recordatorios por vacante,
// y se detiene si el empleador responde CONTRATÉ (whatsapp_seguimiento_detenido).
// Solo a quienes dieron opt-in. El tick corre cada 24 h; la cadencia real la da la condición.
async function seguimientoEmpleadores() {
  try {
    const vacs = await dbQuery(`
      SELECT v.id, v.titulo, v.empleador_id,
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) AS postulados
      FROM vacantes v
      WHERE v.estado = 'activa' AND (v.eliminado IS NULL OR v.eliminado = 0)
        AND (v.whatsapp_seguimiento_detenido IS NULL OR v.whatsapp_seguimiento_detenido = 0)
        AND (v.whatsapp_seguimiento_count IS NULL OR v.whatsapp_seguimiento_count < 4)
        AND (
          (v.whatsapp_seguimiento_at IS NULL AND v.created_at <= (NOW() - INTERVAL 2 DAY))
          OR (v.whatsapp_seguimiento_at <= (NOW() - INTERVAL 7 DAY))
        )
      LIMIT 20
    `).catch(() => []);
    if (!vacs || vacs.length === 0) return;
    const wa = require('./services/whatsappService');
    for (const v of vacs) {
      const n = Number(v.postulados || 0);
      const u = await dbQuery('SELECT whatsapp_opt_in FROM usuarios WHERE id = ?', [v.empleador_id]).catch(() => []);
      if (u && u[0] && u[0].whatsapp_opt_in) {
        const destino = await wa.mejorDestino(v.empleador_id);
        if (destino) {
          const candidatos = n > 0
            ? `Ya tienes *${n}* candidato(s) esperando.`
            : `Aún no tienes candidatos; ajusta el pago o requisitos en la app para atraer más gente.`;
          const txt =
            `👋 Seguimiento de tu vacante *${v.titulo}*.\n\n` +
            `¿Ya *contrataste* a alguien para esta vacante?\n` +
            `• Si ya la cubriste, responde *CONTRATÉ* y dejo de recordártelo.\n` +
            `• Si sigues buscando, escribe *Ver trabajadores* para ver quién encaja. ${candidatos}\n\n` +
            `👉 ${wa.linkVacante(v.id)}`;
          await wa.enviarTexto(destino, txt, { usuarioId: v.empleador_id }).catch(() => {});
        }
      }
      await dbQuery(
        'UPDATE vacantes SET whatsapp_seguimiento_at = NOW(), whatsapp_seguimiento_count = COALESCE(whatsapp_seguimiento_count, 0) + 1 WHERE id = ?',
        [v.id]
      ).catch(() => {});
    }
    console.log(`[SEGUIMIENTO] ${vacs.length} vacante(s) procesada(s).`);
  } catch (err) {
    console.error('[SEGUIMIENTO] error:', err.message);
  }
}

// Recordatorio matutino de asistencia (PASO 5): la mañana de la jornada, a los trabajadores
// aceptados que NO confirmaron, les pregunta VOY / NO VOY. Corre cada hora pero solo actúa
// en la franja de la mañana (hora local Colombia 5–10) y una sola vez por postulación.
async function recordatorioAsistencia() {
  try {
    const horaCo = (new Date().getUTCHours() - 5 + 24) % 24; // hora local Colombia (UTC-5)
    if (horaCo < 5 || horaCo > 10) return; // solo en la mañana
    // Fecha "hoy" en Colombia (YYYY-MM-DD).
    const hoyCo = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

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
    if (!posts || posts.length === 0) return;

    const wa = require('./services/whatsappService');
    for (const p of posts) {
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
    console.log(`[RECORDATORIO] ${posts.length} recordatorio(s) de asistencia enviados.`);
  } catch (err) {
    console.error('[RECORDATORIO] error:', err.message);
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

  // Seguimiento a empleadores: corrida a los 2 min y luego cada 24 h.
  setTimeout(() => seguimientoEmpleadores(), 2 * 60 * 1000);
  setInterval(() => seguimientoEmpleadores(), 24 * 60 * 60 * 1000);

  // Recordatorio matutino de asistencia (VOY/NO VOY): corrida a los 3 min y luego cada hora
  // (solo actúa en la franja de la mañana Colombia).
  setTimeout(() => recordatorioAsistencia(), 3 * 60 * 1000);
  setInterval(() => recordatorioAsistencia(), 60 * 60 * 1000);

  // Barrido de la lista de espera (ofertas de cupo vencidas): cada 10 min.
  setInterval(() => barrerListaEspera(), 10 * 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌿 TerraEmpleo API corriendo en http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);
    console.log('Cognito SMS verification ready');
  });
}

startServer();

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

// Auto-cierre de vacantes expiradas
const { query: dbQuery } = require('./config/database');
async function cerrarVacantesExpiradas() {
  try {
    const result = await dbQuery(
      "UPDATE vacantes SET estado = 'cerrada' WHERE fecha_fin IS NOT NULL AND fecha_fin < CURDATE() AND estado = 'activa'"
    );
    if (result.affectedRows > 0) {
      console.log(`[AUTO-CLOSE] ${result.affectedRows} vacante(s) cerrada(s) por fecha de finalización.`);
    }
  } catch (err) {
    console.error('[AUTO-CLOSE] Error cerrando vacantes expiradas:', err.message);
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
    console.log('[INIT] Base de datos inicializada correctamente');
  } catch (err) {
    console.error('[INIT] Error inicializando base de datos:', err.code || '', err.message);
    console.error('[INIT] El servidor arrancará sin garantías de schema. Verifica la conexión a la BD.');
  }

  // Cerrar vacantes expiradas al iniciar y cada hora
  cerrarVacantesExpiradas();
  setInterval(cerrarVacantesExpiradas, 60 * 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌿 TerraEmpleo API corriendo en http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);
    console.log('Cognito SMS verification ready');
  });
}

startServer();

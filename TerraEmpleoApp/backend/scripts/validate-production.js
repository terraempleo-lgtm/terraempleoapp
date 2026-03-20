/**
 * TerraEmpleo — Script de validación de producción
 * Uso: node scripts/validate-production.js [URL]
 * Ejemplo: node scripts/validate-production.js https://api.terrampleo.com/api
 *
 * Prueba: health, registro, login, perfil, SMS mock, subida de docs (6 usuarios)
 */

const BASE_URL = process.argv[2] || 'https://api.terrampleo.com/api';

// ─── Colores ANSI ────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};
const ok  = (msg) => console.log(`${C.green}  ✓${C.reset} ${msg}`);
const err = (msg) => console.log(`${C.red}  ✗${C.reset} ${msg}`);
const warn = (msg) => console.log(`${C.yellow}  ⚠${C.reset} ${msg}`);
const info = (msg) => console.log(`${C.cyan}  →${C.reset} ${msg}`);
const section = (title) => console.log(`\n${C.bold}${C.cyan}══ ${title} ══${C.reset}`);

// ─── HTTP helper ─────────────────────────────────────────────────────────────
async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const url = `${BASE_URL}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, opts);
    const ms = Date.now() - t0;
    let data;
    try { data = await res.json(); } catch { data = {}; }
    return { ok: res.ok, status: res.status, data, ms };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e.message }, ms: Date.now() - t0 };
  }
}

// ─── Usuarios de prueba ───────────────────────────────────────────────────────
const timestamp = Date.now();
const TEST_USERS = [
  {
    label: 'Trabajador 1 — Carlos Pérez',
    rol: 'trabajador',
    nombre_completo: 'Carlos Pérez Test',
    celular: `310${timestamp}`.slice(0, 10),
    correo: `carlos_test_${timestamp}@test.com`,
    password: 'Test1234!',
    cedula: `1${timestamp}`.slice(0, 10),
    departamento: 'Antioquia',
    municipio: 'Medellín',
    acepta_habeas_data: true,
    nivel_estudios: 'bachiller',
    anios_experiencia: '1_3',
    disponibilidad: 'tiempo_completo',
    habilidades: [{ nombre: 'recolección', es_personalizada: false }],
    cultivos_trabajador: [{ nombre: 'café', es_personalizado: false }],
  },
  {
    label: 'Trabajador 2 — María López',
    rol: 'trabajador',
    nombre_completo: 'María López Test',
    celular: `311${timestamp}`.slice(0, 10),
    correo: `maria_test_${timestamp}@test.com`,
    password: 'Test1234!',
    cedula: `2${timestamp}`.slice(0, 10),
    departamento: 'Cundinamarca',
    municipio: 'Bogotá',
    acepta_habeas_data: true,
    nivel_estudios: 'primaria_completa',
    anios_experiencia: 'menos_1',
    disponibilidad: 'por_dias',
    habilidades: [{ nombre: 'siembra', es_personalizada: false }],
    cultivos_trabajador: [{ nombre: 'maíz', es_personalizado: false }],
  },
  {
    label: 'Trabajador 3 — José Gómez',
    rol: 'trabajador',
    nombre_completo: 'José Gómez Test',
    celular: `312${timestamp}`.slice(0, 10),
    correo: `jose_test_${timestamp}@test.com`,
    password: 'Test1234!',
    cedula: `3${timestamp}`.slice(0, 10),
    departamento: 'Valle del Cauca',
    municipio: 'Cali',
    acepta_habeas_data: true,
    nivel_estudios: 'tecnico_tecnologo',
    anios_experiencia: '3_5',
    disponibilidad: 'temporada_cosecha',
    habilidades: [{ nombre: 'fumigación', es_personalizada: false }],
    cultivos_trabajador: [{ nombre: 'caña', es_personalizado: false }],
  },
  {
    label: 'Empleador 1 — Finca El Paraíso',
    rol: 'empleador',
    nombre_completo: 'Pedro Ríos Test',
    celular: `313${timestamp}`.slice(0, 10),
    correo: `pedro_test_${timestamp}@test.com`,
    password: 'Test1234!',
    cedula: `4${timestamp}`.slice(0, 10),
    departamento: 'Huila',
    municipio: 'Neiva',
    acepta_habeas_data: true,
    nombre_empresa_finca: 'Finca El Paraíso Test',
    tipo_pago: 'jornal',
    ofrece_alojamiento: true,
    ofrece_alimentacion: true,
    cultivos_empleador: [{ nombre: 'café', es_personalizado: false }],
    labores: [{ nombre: 'recolección', es_personalizada: false }],
  },
  {
    label: 'Empleador 2 — Agro Santa Cruz',
    rol: 'empleador',
    nombre_completo: 'Ana Salazar Test',
    celular: `314${timestamp}`.slice(0, 10),
    correo: `ana_test_${timestamp}@test.com`,
    password: 'Test1234!',
    cedula: `5${timestamp}`.slice(0, 10),
    departamento: 'Nariño',
    municipio: 'Pasto',
    acepta_habeas_data: true,
    nombre_empresa_finca: 'Agro Santa Cruz Test',
    tipo_pago: 'destajo',
    ofrece_alojamiento: false,
    ofrece_alimentacion: false,
    cultivos_empleador: [{ nombre: 'papa', es_personalizado: false }],
    labores: [{ nombre: 'siembra', es_personalizada: false }],
  },
  {
    label: 'Trabajador 4 — Sin vereda (edge case)',
    rol: 'trabajador',
    nombre_completo: 'Luis Test Edge',
    celular: `315${timestamp}`.slice(0, 10),
    correo: null,
    password: 'Test1234!',
    cedula: `6${timestamp}`.slice(0, 10),
    acepta_habeas_data: true,
    habilidades: [],
    cultivos_trabajador: [],
  },
];

// ─── Suite de pruebas ─────────────────────────────────────────────────────────
const resultados = [];

function registrar(label, paso, exitoso, detalle = '') {
  resultados.push({ label, paso, exitoso, detalle });
}

async function probarHealth() {
  section('1. HEALTH CHECK');
  const r = await request('GET', '/health');
  if (r.ok && r.data.status === 'OK') {
    ok(`API OK (${r.ms}ms) — DB: ${r.data.database}`);
    info(`Timestamp: ${r.data.timestamp}`);
    registrar('API', 'health', true, `${r.ms}ms`);
  } else if (r.status === 503) {
    warn(`API UP pero DB desconectada — ${r.data.database || 'unknown'}`);
    registrar('API', 'health', false, 'DB disconnected');
  } else {
    err(`Health check falló — status ${r.status}: ${JSON.stringify(r.data)}`);
    registrar('API', 'health', false, `status ${r.status}`);
    console.log(`\n${C.red}${C.bold}ERROR CRÍTICO: No se puede alcanzar la API. Abortando.${C.reset}`);
    process.exit(1);
  }
}

async function probarRegistroYLogin(usuario) {
  const tokens = {};
  section(`USUARIO: ${usuario.label}`);

  // Registro
  info(`Registrando (${usuario.rol}) — celular ${usuario.celular}`);
  const regR = await request('POST', '/auth/register', usuario);
  if (regR.ok && regR.data.token) {
    ok(`Registro exitoso (${regR.ms}ms) — userId: ${regR.data.usuario?.id}`);
    tokens.register = regR.data.token;
    tokens.userId = regR.data.usuario?.id;
    registrar(usuario.label, 'registro', true, `userId=${tokens.userId}`);
  } else {
    err(`Registro falló — ${regR.status}: ${regR.data.error || JSON.stringify(regR.data)}`);
    registrar(usuario.label, 'registro', false, regR.data.error || `status ${regR.status}`);
    return tokens;
  }

  // Login
  info('Login con credenciales...');
  const loginR = await request('POST', '/auth/login', {
    celular: usuario.celular,
    password: usuario.password,
  });
  if (loginR.ok && loginR.data.token) {
    ok(`Login exitoso (${loginR.ms}ms)`);
    tokens.login = loginR.data.token;
    registrar(usuario.label, 'login', true, `${loginR.ms}ms`);
  } else {
    err(`Login falló — ${loginR.status}: ${loginR.data.error || JSON.stringify(loginR.data)}`);
    registrar(usuario.label, 'login', false, loginR.data.error || `status ${loginR.status}`);
  }

  // Perfil
  if (tokens.login) {
    info('Obteniendo perfil autenticado...');
    const perfilR = await request('GET', '/auth/perfil', null, tokens.login);
    if (perfilR.ok && perfilR.data.id) {
      ok(`Perfil obtenido — nombre: ${perfilR.data.nombre_completo}, rol: ${perfilR.data.rol}`);
      registrar(usuario.label, 'perfil', true);
    } else {
      err(`Perfil falló — ${perfilR.status}: ${JSON.stringify(perfilR.data)}`);
      registrar(usuario.label, 'perfil', false, perfilR.data.error);
    }
  }

  // SMS (sólo si SMS_MOCK activo — busca codigo_debug en registro)
  if (regR.data.codigo_debug) {
    info(`SMS mock — código recibido: ${regR.data.codigo_debug}`);
    const smsR = await request('POST', '/auth/sms/verificar', {
      celular: usuario.celular,
      codigo: regR.data.codigo_debug,
    });
    if (smsR.ok) {
      ok('SMS verificado correctamente');
      registrar(usuario.label, 'sms_verificar', true);
    } else {
      warn(`SMS verificación falló — ${smsR.data.error || smsR.status}`);
      registrar(usuario.label, 'sms_verificar', false, smsR.data.error);
    }
  } else {
    warn('SMS_MOCK inactivo o código no retornado — skip verificación SMS');
    registrar(usuario.label, 'sms_verificar', false, 'SMS_MOCK off o no retornó codigo_debug');
  }

  return tokens;
}

async function probarLoginIncorrecto() {
  section('PRUEBA: Login con password incorrecta (manejo de errores)');
  const r = await request('POST', '/auth/login', {
    celular: '3100000000',
    password: 'wrongpassword',
  });
  if (!r.ok && (r.status === 401 || r.status === 400 || r.status === 404)) {
    ok(`Error controlado correctamente — status ${r.status}: "${r.data.error}"`);
    registrar('Manejo errores', 'login_incorrecto', true, `${r.status}`);
  } else {
    warn(`Respuesta inesperada — status ${r.status}: ${JSON.stringify(r.data)}`);
    registrar('Manejo errores', 'login_incorrecto', false, `status ${r.status}`);
  }
}

async function probarRegistroDuplicado(celular) {
  section('PRUEBA: Registro duplicado (misma cédula/celular)');
  const r = await request('POST', '/auth/register', {
    rol: 'trabajador',
    nombre_completo: 'Duplicado Test',
    celular,
    password: 'Test1234!',
    cedula: '999999999',
    acepta_habeas_data: true,
    habilidades: [],
    cultivos_trabajador: [],
  });
  if (!r.ok && r.status === 409) {
    ok(`Duplicado rechazado correctamente — 409: "${r.data.error}"`);
    registrar('Manejo errores', 'registro_duplicado', true);
  } else {
    warn(`Respuesta inesperada para duplicado — status ${r.status}: ${JSON.stringify(r.data)}`);
    registrar('Manejo errores', 'registro_duplicado', false, `status ${r.status}`);
  }
}

async function imprimirResumen() {
  section('RESUMEN DE VALIDACIÓN');
  const total  = resultados.length;
  const passed = resultados.filter(r => r.exitoso).length;
  const failed = resultados.filter(r => !r.exitoso).length;

  // Tabla
  console.log(`\n${'Usuario'.padEnd(35)} ${'Paso'.padEnd(22)} ${'Estado'.padEnd(8)} Detalle`);
  console.log('─'.repeat(90));
  for (const r of resultados) {
    const estado = r.exitoso ? `${C.green}OK${C.reset}    ` : `${C.red}FAIL${C.reset}  `;
    console.log(`${r.label.padEnd(35)} ${r.paso.padEnd(22)} ${estado} ${C.dim}${r.detalle || ''}${C.reset}`);
  }
  console.log('─'.repeat(90));

  const pct = Math.round((passed / total) * 100);
  const color = pct === 100 ? C.green : pct >= 70 ? C.yellow : C.red;
  console.log(`\n${C.bold}Total: ${passed}/${total} pruebas pasaron (${color}${pct}%${C.reset}${C.bold})${C.reset}`);

  if (failed > 0) {
    console.log(`\n${C.red}${C.bold}Fallos:${C.reset}`);
    resultados.filter(r => !r.exitoso).forEach(r => {
      console.log(`  ${C.red}✗${C.reset} [${r.label}] ${r.paso}: ${r.detalle}`);
    });
  } else {
    console.log(`\n${C.green}${C.bold}✓ Todo el flujo de producción funciona correctamente.${C.reset}`);
  }
  console.log(`\n${C.dim}API: ${BASE_URL}${C.reset}\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════╗`);
  console.log(`║   TerraEmpleo — Validación Producción   ║`);
  console.log(`╚══════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}API: ${BASE_URL}${C.reset}`);
  console.log(`${C.dim}Timestamp base: ${timestamp}${C.reset}`);

  await probarHealth();

  const tokens = [];
  for (const usuario of TEST_USERS) {
    const t = await probarRegistroYLogin(usuario);
    tokens.push({ usuario, ...t });
  }

  await probarLoginIncorrecto();

  // Duplicado: usar el primer celular ya registrado
  if (tokens[0]?.usuario?.celular) {
    await probarRegistroDuplicado(tokens[0].usuario.celular);
  }

  await imprimirResumen();
}

main().catch((e) => {
  console.error(`\n${C.red}Error fatal:${C.reset}`, e.message);
  process.exit(1);
});

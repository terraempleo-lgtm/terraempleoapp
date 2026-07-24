/**
 * conversationEngine.js — Motor conversacional guiado de WhatsApp.
 *
 * Fase 1 (flujo guiado, sin IA libre): el EMPLEADOR crea una solicitud de
 * trabajadores por WhatsApp paso a paso. Al confirmar, se crea una `vacante`
 * normal (reutilizando la infraestructura existente) y se dispara el matching,
 * que a su vez avisa por WhatsApp a los trabajadores con opt-in (flujo 2).
 *
 * Estado por número en `whatsapp_conversaciones` (paso + payload temporal en JSON).
 * Comandos globales: SALIR (opt-out), CANCELAR (cancela el flujo activo).
 */

const { query } = require('../config/database');
const whatsappService = require('./whatsappService');
const nluService = require('./nluService');

const FLUJO_EMPLEADOR = 'empleador_solicitud';
const FLUJO_SOPORTE = 'soporte';
const FLUJO_IDENT = 'identificacion';
const FLUJO_REGISTRO = 'registro';
const FLUJO_CLAVE = 'clave';
const FLUJO_CUADERNO = 'cuaderno'; // embudo de venta del Cuaderno Digital (info → DEMO/PRECIO → ACTIVAR)

// Palabras para crear/cambiar contraseña.
const PALABRAS_CLAVE = ['contraseña', 'contrasena', 'clave', 'password', 'olvidé mi contraseña', 'olvide mi contraseña', 'no tengo contraseña', 'no tengo clave', 'crear contraseña', 'cambiar contraseña', 'cambiar clave'];

// Palabra que dispara el embudo del Cuaderno Digital (marketing/ventas).
const PALABRAS_CUADERNO = ['cuaderno'];

// Respuesta del empleador al seguimiento semanal: ya cubrió la vacante → dejar de recordarle.
const PALABRAS_CONTRATE = ['contraté', 'contrate', 'ya contraté', 'ya contrate', 'conseguí', 'consegui', 'ya conseguí', 'ya consegui', 'ya la llené', 'ya la llene', 'ya contrate a alguien', 'ya la cubrí', 'ya la cubri'];

// Pasos del flujo del empleador, en orden.
const PASOS = ['finca', 'labor', 'cantidad', 'fecha', 'hora', 'pago', 'descripcion', 'fotos', 'confirmar'];

// Enlaces públicos.
const LINK_VACANTE = 'https://app.terrampleo.com/app/vacantes/';
const LINK_APP = 'https://www.terraempleo.com.co';
const LINK_HABEAS = 'https://app.terrampleo.com/privacidad.html';

// ── Copia del embudo del Cuaderno Digital (texto literal aprobado por el equipo) ──
const CUADERNO_INFO =
  'Hola 👋 El *Cuaderno Digital de TerraEmpleo* le permite llevar el control completo de su personal y ' +
  'sus finanzas desde el celular, sin papeles ni Excel. Con el Cuaderno usted puede:\n\n' +
  '• Registrar quién trabajó cada día, en qué lote y qué labor hizo\n' +
  '• Anotar cuántos kilos recolectó cada trabajador\n' +
  '• Ver cuánto le debe pagar a cada uno al final de la semana\n' +
  '• Generar la nómina automáticamente con espacio para firma digital\n' +
  '• Subir su planilla física con una foto y el sistema lee los datos solo\n' +
  '• Registrar gastos e ingresos de la finca en un solo lugar\n' +
  '• Ver un tablero de análisis: costos por kilo, rentabilidad por cultivo, rendimiento por trabajador y más\n\n' +
  '¿Quiere que le mostremos cómo funciona? Escriba *DEMO* para agendar una visita o *PRECIO* para conocer los planes.';

const CUADERNO_DEMO =
  'Perfecto. Uno de nuestros asesores lo llama para agendar una demostración en su finca sin costo. ' +
  '¿Cuál es el mejor horario para llamarle?';

const CUADERNO_PRECIO =
  'Tenemos dos planes:\n\n' +
  '*Plan Conexión — Gratis*\nPublique vacantes, reciba trabajadores verificados y chatee directo con ellos.\n\n' +
  '*Plan Control — $85.000 al mes*\nTodo lo anterior más el Cuaderno Digital completo: registro de kilos, ' +
  'nómina automática, score de trabajadores y recontratación en un clic.\n\n' +
  '¿Le interesa activar el *Plan Control*? Escriba *ACTIVAR* y lo ayudamos a empezar hoy.';

const CUADERNO_ACTIVAR =
  'Excelente. En menos de 10 minutos tiene el Cuaderno activo en su finca. Lo llamamos ahora para ' +
  'ayudarle a configurarlo. ¿A qué número lo contactamos?';

// Palabras que disparan el flujo de soporte (atención humana).
const PALABRAS_SOPORTE = [
  'ayuda', 'soporte', 'problema', 'no puedo', 'no me deja', 'error', 'falla',
  'queja', 'reclamo', 'no funciona', 'asesor', 'humano',
];

// Palabras para "ver ofertas" (trabajador) y para "registrarse" (nuevo).
const PALABRAS_OFERTAS = ['oferta', 'vacante', 'empleo', 'qué hay', 'que hay', 'muéstrame', 'muestrame', 'disponible', 'qué trabajos', 'que trabajos', 'hay trabajo'];
const PALABRAS_REGISTRO = ['registr', 'quiero trabajar', 'soy nuevo', 'nuevo', 'inscribir', 'crear cuenta', 'apuntarme', 'apuntar'];

/** Devuelve el primer campo faltante del flujo del empleador, o 'confirmar' si están todos. */
function siguientePasoFaltante(datos) {
  for (const campo of ['finca', 'labor', 'cantidad', 'fecha', 'pago']) {
    if (datos[campo] === undefined || datos[campo] === null || datos[campo] === '') return campo;
  }
  return 'confirmar';
}

const PREGUNTAS = {
  finca: '🌾 ¿Para qué finca o vereda necesitas trabajadores?',
  labor: '🛠️ ¿Qué labor necesitas? (ej: recolección de café, guadaña, siembra)',
  cantidad: '👥 ¿Cuántos trabajadores necesitas?',
  fecha: '📅 ¿Para qué día los necesitas? Escribe *HOY*, *MAÑANA* o la fecha *DD/MM* (ej: 25/07).',
  hora: '⏰ ¿A qué hora empiezan? (ej: 6:00 a.m.)',
  pago: '💵 ¿Cuánto pagas por jornada? (en pesos, ej: 70000)',
  descripcion: '📝 Describe la vacante: condiciones, horario, requisitos, beneficios… (o escribe NINGUNA)',
  fotos: '📷 Envía 1 a 4 *fotos* de la vacante/finca, o escribe LISTO para publicar sin fotos.',
};

/**
 * Limpieza determinística de una respuesta de texto: quita saludos y frases de
 * relleno al inicio para quedarse con el dato real ("hola finca El Porvenir" → "El Porvenir").
 */
function limpiarRespuesta(texto) {
  let t = String(texto || '').trim();
  // saludos/relleno al inicio
  t = t.replace(/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|qu[eé] m[aá]s|ole|hey|holi|si|sí|claro)[\s,!.:-]+/i, '');
  // frases guía comunes (nombre de finca/labor precedido de relleno)
  t = t.replace(/^(la\s+finca\s+(se\s+llama|es)|el\s+nombre\s+(de\s+la\s+finca\s+)?es|se\s+llama|es\s+(la\s+finca|en\s+la\s+finca)|la\s+labor\s+es|en\s+la\s+finca|finca\s+|vereda\s+|para\s+)/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) return String(texto || '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Parseo determinístico de la fecha de la jornada, en zona Colombia (UTC-5).
 * Acepta HOY / MAÑANA / PASADO MAÑANA, días de semana (→ próxima ocurrencia) y DD/MM(/AAAA).
 * @returns {{iso:string, display:string}|null} null si no se pudo interpretar.
 */
function parseFechaJornada(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!t) return null;
  const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const nowCo = new Date(Date.now() - 5 * 3600 * 1000); // desplazado a hora local Colombia
  const baseY = nowCo.getUTCFullYear(), baseM = nowCo.getUTCMonth(), baseD = nowCo.getUTCDate();
  const mk = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m, d));
    const iso = dt.toISOString().slice(0, 10);
    const display = `${DIAS[dt.getUTCDay()]} ${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
    return { iso, display };
  };
  const hoyIso = mk(baseY, baseM, baseD).iso;

  if (/\bhoy\b/.test(t)) return mk(baseY, baseM, baseD);
  if (/pasado\s*manana/.test(t)) return mk(baseY, baseM, baseD + 2);
  if (/\bmanana\b/.test(t)) return mk(baseY, baseM, baseD + 1);

  for (let i = 0; i < DIAS.length; i++) {
    if (t.includes(DIAS[i])) {
      const hoyDow = new Date(Date.UTC(baseY, baseM, baseD)).getUTCDay();
      let delta = (i - hoyDow + 7) % 7;
      if (delta === 0) delta = 7; // "el lunes" = el próximo lunes, no hoy
      return mk(baseY, baseM, baseD + delta);
    }
  }

  const m = t.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?/);
  if (m) {
    const d = parseInt(m[1], 10), mes = parseInt(m[2], 10) - 1;
    let y = m[3] ? parseInt(m[3], 10) : baseY;
    if (y < 100) y += 2000;
    if (mes < 0 || mes > 11 || d < 1 || d > 31) return null;
    let cand = mk(y, mes, d);
    if (!m[3] && cand.iso < hoyIso) cand = mk(baseY + 1, mes, d); // sin año y ya pasó → próximo año
    return cand;
  }
  return null;
}

function mapDisponibilidad(t) {
  t = (t || '').toLowerCase();
  if (t.includes('compl')) return 'tiempo_completo';
  if (t.includes('inmediat')) return 'disponible_inmediatamente';
  if (t.includes('cosech') || t.includes('tempor')) return 'temporada_cosecha';
  if (t.includes('fin') || t.includes('semana')) return 'fines_semana';
  if (t.includes('dia') || t.includes('día')) return 'por_dias';
  return null;
}
function mapTipoPago(t) {
  t = (t || '').toLowerCase();
  if (t.includes('jornal')) return 'jornal';
  if (t.includes('seman')) return 'semanal';
  if (t.includes('quincen')) return 'quincenal';
  if (t.includes('kilo')) return 'por_kilo';
  if (t.includes('destaj')) return 'destajo';
  if (t.includes('mensual') || t.includes('mes')) return 'mensual';
  return 'jornal';
}

// ── Variación de mensajes (para que el bot no suene robótico) ───────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function saludoAsistente(usuario) {
  const n = ((usuario && usuario.nombre_completo) || '').split(' ')[0] || '';
  const con = n ? [
    `Hola ${n} 👋 Soy el asistente de TerraEmpleo.`,
    `¡Buenas, ${n}! 🌱 Te habla el asistente de TerraEmpleo.`,
    `¡Qué más, ${n}! 👋 Soy el asistente de TerraEmpleo.`,
    `¡Hola ${n}! 🙌 Soy el asistente de TerraEmpleo.`,
  ] : [
    'Hola 👋 Soy el asistente de TerraEmpleo.',
    '¡Buenas! 🌱 Te habla el asistente de TerraEmpleo.',
    '¡Hola! 🙌 Soy el asistente de TerraEmpleo.',
  ];
  return pick(con);
}

function menuGenerico() {
  return pick([
    '🌱 ¿Buscas trabajo? Escribe *OFERTAS* para ver vacantes, o *REGISTRARME* para crear tu cuenta.\n¿Tienes finca y necesitas gente? Escribe *Necesito trabajadores*.',
    'Te cuento lo que puedo hacer:\n• *OFERTAS* → ver trabajos disponibles\n• *REGISTRARME* → crear tu cuenta\n• *Necesito trabajadores* → si eres finca/empleador',
    'Puedo ayudarte con:\n🌾 *OFERTAS* (ver vacantes)\n📝 *REGISTRARME* (crear cuenta)\n👨‍🌾 *Necesito trabajadores* (si eres empleador)',
  ]);
}

function soporteIntro() {
  return pick([
    '🙋 Con gusto te ayudo. Cuéntame en una frase qué necesitas o cuál es el problema, y te respondo o te paso con un asesor.',
    '🙋 Claro, para ayudarte cuéntame brevemente qué pasó o qué necesitas.',
    'Estoy para ayudarte 🙌. Dime en pocas palabras cuál es el problema o qué necesitas.',
  ]);
}

function soporteCierre() {
  return pick([
    '¡Gracias! 🙌 Registré tu mensaje y un asesor de TerraEmpleo te contactará pronto por este mismo chat.',
    '¡Listo! ✅ Le pasé tu caso a un asesor; te escribirá pronto por aquí.',
    'Gracias por escribir 🌱. Un asesor revisará tu caso y te responderá pronto por este chat.',
  ]);
}

function sufijoConfirmar() {
  return pick([
    'Responde *CONFIRMAR* para publicarla o *CORREGIR* para empezar de nuevo.',
    '¿Todo bien? Responde *CONFIRMAR* para publicar, o *CORREGIR* para volver a empezar.',
    'Si está correcto responde *CONFIRMAR*; si no, *CORREGIR* para empezar de nuevo.',
  ]);
}

function registroBienvenida() {
  return pick([
    '¡Bienvenido a TerraEmpleo! 🌱 Te ayudo a crear tu cuenta.',
    '¡Qué bueno tenerte en TerraEmpleo! 🌱 Vamos a crear tu cuenta.',
    '¡Genial! 🙌 Creemos tu cuenta en TerraEmpleo, es rápido.',
  ]);
}

function menuTrabajador() {
  return pick([
    'Hola 👋 Soy el asistente de TerraEmpleo. Escribe *OFERTAS* para ver trabajos disponibles, o abre la app para postularte. Te aviso por aquí cuando haya algo que encaje contigo.',
    '🌱 Escribe *OFERTAS* para ver las vacantes, o abre la app para postularte. Yo te aviso cuando salga algo para ti.',
    '👋 Para ver trabajos escribe *OFERTAS*; para postularte entra a la app. Te avisaré cuando haya match con tu perfil.',
  ]);
}

/** Saludo personalizado por nombre (si se reconoce) + menú según rol. */
function bienvenidaPersonal(usuario) {
  const n = usuario && usuario.nombre_completo ? ' ' + usuario.nombre_completo.split(' ')[0] : '';
  const s = pick([`¡Hola${n}! 👋`, `¡Buenas${n}! 🌱`, `¡Qué más${n}! 👋`, `¡Hola${n}! 🙌`]);
  if (usuario && (usuario.rol === 'empleador' || usuario.rol === 'admin')) {
    return `${s} Soy el asistente de TerraEmpleo. Para publicar una vacante escribe *Necesito trabajadores*, *Ver trabajadores* para ver quién encaja con tu perfil, o *CUADERNO* para conocer el Cuaderno Digital. ¿En qué te ayudo?`;
  }
  if (usuario && usuario.rol === 'trabajador') {
    return `${s} Soy el asistente de TerraEmpleo. Escribe *OFERTAS* para ver los trabajos disponibles. ¿En qué te ayudo?`;
  }
  return `${s} Soy el asistente de TerraEmpleo. Escribe *OFERTAS* para ver trabajos, *REGISTRARME* para crear tu cuenta, o *Necesito trabajadores* si tienes finca. ¿En qué te ayudo?`;
}

/**
 * Fallback cuando el mensaje no encajó en ningún flujo: la IA responde con la base de
 * conocimiento + datos del usuario, o decide escalar. Registra la pregunta (aprendizaje).
 * Si la IA no está, devuelve un menú genérico variado.
 */
async function fallbackInteligente({ usuario, telefono, comando, esTrabajador }) {
  const kb = await query('SELECT clave, pregunta, respuesta FROM whatsapp_kb WHERE activo = 1 LIMIT 40').catch(() => []);
  const r = await nluService.responderLibre(comando, { usuario, kb }).catch(() => null);
  // Bitácora de aprendizaje: queda registrado para que los admins enriquezcan la KB.
  await query(
    'INSERT INTO whatsapp_preguntas (telefono, usuario_id, texto, accion) VALUES (?, ?, ?, ?)',
    [telefono, usuario ? usuario.id : null, comando, r ? r.accion : 'sin_ia']
  ).catch(() => {});
  if (r && r.mensaje) {
    if (r.accion === 'escalar') { await escalarSoporte(usuario, telefono, comando); return r.mensaje; }
    return r.mensaje;
  }
  return esTrabajador ? menuTrabajador() : menuGenerico();
}

const PALABRAS_INICIO = [
  'necesito', 'nueva solicitud', 'solicitud', 'publicar', 'trabajadores',
  'recolectores', 'busco', 'requiero', 'contratar',
];

// Saludos (tolerante a typos): un saludo NO debe arrancar el flujo de vacante ni escalar.
const PALABRAS_SALUDO = ['hola', 'holas', 'ola', 'buenas', 'buenos dias', 'buenos días', 'buen dia', 'qué más', 'que mas', 'hey', 'holi', 'saludos', 'buenas tardes', 'buenas noches'];

function normalizarComando(texto) {
  return (texto || '').trim();
}

function parseDatos(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

async function getConversacionActiva(telefono) {
  const rows = await query(
    `SELECT * FROM whatsapp_conversaciones
     WHERE telefono = ? AND estado = 'activa'
     ORDER BY id DESC LIMIT 1`,
    [telefono]
  ).catch(() => []);
  return rows && rows[0] ? rows[0] : null;
}

async function crearConversacion(telefono, usuarioId, flujo, paso) {
  const res = await query(
    `INSERT INTO whatsapp_conversaciones (telefono, usuario_id, flujo, paso, datos, estado)
     VALUES (?, ?, ?, ?, ?, 'activa')`,
    [telefono, usuarioId, flujo, paso, JSON.stringify({})]
  );
  return Number(res.insertId);
}

async function actualizarConversacion(id, { paso, datos, estado }) {
  const sets = [];
  const params = [];
  if (paso !== undefined) { sets.push('paso = ?'); params.push(paso); }
  if (datos !== undefined) { sets.push('datos = ?'); params.push(JSON.stringify(datos)); }
  if (estado !== undefined) { sets.push('estado = ?'); params.push(estado); }
  sets.push('last_message_at = CURRENT_TIMESTAMP');
  params.push(id);
  await query(`UPDATE whatsapp_conversaciones SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** Crea la vacante a partir de los datos recolectados y dispara el matching. */
async function crearVacanteDesdeWhatsapp(empleadorId, datos) {
  // Ubicación: tomamos la del empleador para que el matching por cercanía funcione.
  const ubic = await query(
    'SELECT departamento, municipio FROM usuarios WHERE id = ?',
    [empleadorId]
  ).catch(() => []);
  const departamento = ubic?.[0]?.departamento || null;
  const municipio = ubic?.[0]?.municipio || null;

  const monto = parseInt(String(datos.pago || '').replace(/\D/g, ''), 10) || null;
  const titulo = `${datos.labor || 'Trabajo agrícola'}${datos.finca ? ' - ' + datos.finca : ''}`.slice(0, 250);
  const desc = (datos.descripcion && datos.descripcion.toUpperCase() !== 'NINGUNA')
    ? datos.descripcion
    : `Solicitud por WhatsApp · ${datos.cantidad || '-'} trabajador(es) · Fecha: ${datos.fecha || '-'}${datos.hora ? ' · Hora: ' + datos.hora : ''}`;

  const result = await query(
    `INSERT INTO vacantes
       (empleador_id, titulo, descripcion, tipo_pago, monto_pago, departamento, municipio, vereda, urgente, fecha_jornada, hora_jornada)
     VALUES (?, ?, ?, 'jornal', ?, ?, ?, ?, 1, ?, ?)`,
    [empleadorId, titulo, desc, monto, departamento, municipio, datos.finca || null, datos.fecha_jornada || null, datos.hora || null]
  );
  const vacanteId = Number(result.insertId);

  if (datos.labor) {
    await query('INSERT INTO vacante_labores (vacante_id, labor) VALUES (?, ?)', [vacanteId, datos.labor]);
  }

  // Fotos recolectadas por WhatsApp (ya subidas a S3 durante el flujo).
  if (Array.isArray(datos.fotos)) {
    let orden = 0;
    for (const url of datos.fotos) {
      await query('INSERT INTO vacante_fotos (vacante_id, url, orden) VALUES (?, ?, ?)', [vacanteId, url, orden++])
        .catch((e) => console.error('[WhatsApp] foto vacante:', e.message));
    }
  }

  // Matching en background: crea postulaciones match_auto + notifica (app + WhatsApp opt-in).
  // require diferido para no acoplar la carga del módulo a la config de S3 del controller.
  const { ejecutarMatching } = require('../controllers/vacantesController');
  ejecutarMatching(vacanteId).catch((e) => console.error('[WhatsApp] matching:', e.message));

  return { vacanteId, titulo, monto };
}

function resumenSolicitud(datos) {
  const pago = datos.pago ? `$${(parseInt(String(datos.pago).replace(/\D/g, ''), 10) || 0).toLocaleString('es-CO')}` : '-';
  return (
    '📋 *Entendí esta solicitud:*\n\n' +
    `🌾 Finca: ${datos.finca || '-'}\n` +
    `🛠️ Labor: ${datos.labor || '-'}\n` +
    `👥 Trabajadores: ${datos.cantidad || '-'}\n` +
    `📅 Fecha: ${datos.fecha || '-'}\n` +
    `⏰ Hora: ${datos.hora || '-'}\n` +
    `💵 Pago por jornada: ${pago}\n\n` +
    sufijoConfirmar()
  );
}

/** Registra un caso de soporte (PQRS si el usuario está registrado) y avisa a los admins. */
async function escalarSoporte(usuario, telefono, descripcion) {
  try {
    if (usuario && usuario.id) {
      await query(
        `INSERT INTO pqrs (usuario_id, tipo, asunto, descripcion, estado)
         VALUES (?, 'peticion', 'Soporte vía WhatsApp', ?, 'recibido')`,
        [usuario.id, descripcion]
      ).catch((e) => console.error('[WhatsApp] PQRS:', e.message));
    }
    // Avisar a los admins (require diferido para no acoplar la carga del módulo).
    const { crearNotificacion } = require('../controllers/notificacionesController');
    const admins = await query(
      `SELECT id FROM usuarios WHERE rol = 'admin' AND activo = 1`
    ).catch(() => []);
    const quien = usuario ? (usuario.nombre_completo || telefono) : telefono;
    for (const a of (admins || [])) {
      crearNotificacion(
        a.id, 'soporte_whatsapp', 'Soporte por WhatsApp',
        `${quien}: ${String(descripcion).slice(0, 140)}`, {}
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[WhatsApp] escalarSoporte:', err.message);
  }
}

/**
 * Registra un lead del Cuaderno Digital (embudo CUADERNO) y avisa a los admins para que
 * el equipo llame. Reutiliza el patrón de escalarSoporte (crearNotificacion a admins).
 * @param {object|null} usuario  fila de usuarios (si se reconoce)
 * @param {string} telefono      número del que escribe
 * @param {'demo'|'activar'} tipo intención del lead
 * @param {string} detalle       horario (demo) o número de contacto (activar)
 */
async function registrarLeadCuaderno(usuario, telefono, tipo, detalle) {
  try {
    const { crearNotificacion } = require('../controllers/notificacionesController');
    const admins = await query(
      `SELECT id FROM usuarios WHERE rol = 'admin' AND activo = 1`
    ).catch(() => []);
    const quien = usuario ? (usuario.nombre_completo || telefono) : telefono;
    const titulo = tipo === 'activar' ? 'Lead Cuaderno: ACTIVAR' : 'Lead Cuaderno: DEMO';
    const cuerpo = tipo === 'activar'
      ? `${quien} (${telefono}) quiere ACTIVAR el Plan Control. Contactar al: ${detalle}`
      : `${quien} (${telefono}) pidió una DEMO del Cuaderno. Horario preferido: ${detalle}`;
    for (const a of (admins || [])) {
      crearNotificacion(a.id, 'lead_cuaderno', titulo, cuerpo, { telefono, tipo, detalle }).catch(() => {});
    }
    // Bitácora reutilizando whatsapp_preguntas (para que quede registro consultable).
    await query(
      'INSERT INTO whatsapp_preguntas (telefono, usuario_id, texto, accion) VALUES (?, ?, ?, ?)',
      [telefono, usuario ? usuario.id : null, `[${titulo}] ${detalle}`, `lead_${tipo}`]
    ).catch(() => {});
  } catch (err) {
    console.error('[WhatsApp] registrarLeadCuaderno:', err.message);
  }
}

/**
 * El empleador respondió "CONTRATÉ" al seguimiento semanal: detiene el recordatorio de su
 * vacante activa más reciente que ya estaba en seguimiento. No toca `estado` (el job
 * reactivarVacantes reabre las 'cerradas' al reiniciar), solo marca `whatsapp_seguimiento_detenido`.
 * @returns {Promise<{ok:boolean, titulo?:string}>}
 */
async function detenerSeguimientoVacante(empleadorId) {
  if (!empleadorId) return { ok: false };
  const rows = await query(
    `SELECT id, titulo FROM vacantes
     WHERE empleador_id = ? AND estado = 'activa' AND (eliminado IS NULL OR eliminado = 0)
       AND whatsapp_seguimiento_at IS NOT NULL
       AND (whatsapp_seguimiento_detenido IS NULL OR whatsapp_seguimiento_detenido = 0)
     ORDER BY whatsapp_seguimiento_at DESC LIMIT 1`,
    [empleadorId]
  ).catch(() => []);
  if (!rows || !rows[0]) return { ok: false };
  await query('UPDATE vacantes SET whatsapp_seguimiento_detenido = 1 WHERE id = ?', [rows[0].id]).catch(() => {});
  return { ok: true, titulo: rows[0].titulo };
}

/** Busca un usuario empleador/admin por el celular que escribe (últimos 10 dígitos). */
async function matchUsuarioPorCelular(textoNumero) {
  const ult10 = String(textoNumero || '').replace(/\D/g, '').slice(-10);
  if (ult10.length < 10) return null;
  const rows = await query(
    `SELECT id, nombre_completo, rol, celular, whatsapp_opt_in
     FROM usuarios
     WHERE activo = 1 AND (baneado IS NULL OR baneado = 0)
       AND rol IN ('empleador','admin')
       AND RIGHT(REPLACE(REPLACE(REPLACE(celular,'+',''),' ',''),'-',''), 10) = ?
     LIMIT 1`,
    [ult10]
  ).catch(() => []);
  return rows && rows[0] ? rows[0] : null;
}

/** Guarda (o actualiza) el mapeo JID (incluye @lid) → usuario. */
async function guardarIdentidad(jid, usuarioId) {
  if (!jid) return;
  await query(
    `INSERT INTO whatsapp_identidades (jid, usuario_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id)`,
    [jid, usuarioId]
  ).catch((e) => console.error('[WhatsApp] guardarIdentidad:', e.message));
}

/** Entra al paso de confirmación: pasa los datos por Bedrock (1 llamada) para pulir el resumen. */
async function irAConfirmar(conv, datos) {
  const rev = await nluService.revisarSolicitud(datos).catch(() => null);
  if (rev) {
    datos.finca = rev.finca || datos.finca;
    datos.labor = rev.labor || datos.labor;
    datos.cantidad = rev.cantidad || datos.cantidad;
    datos.fecha = rev.fecha || datos.fecha;
    datos.pago = rev.pago || datos.pago;
  }
  await actualizarConversacion(conv.id, { paso: 'confirmar', datos });
  const cuerpo = (rev && rev.resumen)
    ? `${rev.resumen}\n\n${sufijoConfirmar()}`
    : resumenSolicitud(datos);
  return { reply: cuerpo, conversacionId: conv.id };
}

/**
 * Envía las vacantes activas, UN mensaje por oferta, con foto (si tiene) + pago +
 * descripción + link de postulación. Los mensajes se envían directamente (varios),
 * por eso devuelve { reply: null } salvo cuando no hay ofertas.
 */
async function enviarOfertas(destino) {
  const vacs = await query(
    `SELECT v.id, v.titulo, v.descripcion, v.municipio, v.departamento, v.monto_pago,
       (SELECT url FROM vacante_fotos WHERE vacante_id = v.id ORDER BY orden ASC LIMIT 1) AS foto
     FROM vacantes v
     WHERE v.estado = 'activa' AND (v.eliminado IS NULL OR v.eliminado = 0)
     ORDER BY v.created_at DESC LIMIT 5`
  ).catch(() => []);
  if (!vacs || vacs.length === 0) {
    return { reply: 'Por ahora no hay vacantes activas. Te avisaré por aquí apenas aparezca una que encaje contigo. 🌱' };
  }

  await whatsappService.enviarTexto(destino, `🌱 *${vacs.length} oferta(s) disponible(s) para ti:*`);
  const { signUrl } = require('../config/s3');
  for (const v of vacs) {
    const lugar = [v.municipio, v.departamento].filter(Boolean).join(', ') || 'Colombia';
    const pago = v.monto_pago ? `\n💵 Pago: $${Number(v.monto_pago).toLocaleString('es-CO')}` : '';
    const desc = v.descripcion ? `\n📝 ${String(v.descripcion).slice(0, 350)}` : '';
    const caption = `🌾 *${v.titulo}*\n📍 ${lugar}${pago}${desc}\n\n👉 Postúlate aquí: ${LINK_VACANTE}${v.id}`;
    let enviada = false;
    if (v.foto) {
      const signed = await signUrl(v.foto).catch(() => null);
      if (signed) {
        const r = await whatsappService.enviarImagen(destino, signed, caption).catch(() => ({ ok: false }));
        enviada = !!(r && r.ok);
      }
    }
    if (!enviada) await whatsappService.enviarTexto(destino, caption);
  }
  return { reply: null };
}

/**
 * ¿El mensaje pide VER trabajadores disponibles (distinto de "necesito trabajadores",
 * que crea una vacante)? Requiere mencionar trabajadores/personal + una acción de ver,
 * y NO ser una intención de contratar/publicar.
 */
function pareceVerTrabajadores(textoLower) {
  const t = textoLower || '';
  // Señales fuertes que por sí solas indican "ver perfiles".
  if (/(candidat|hoja[s]? de vida|mano de obra)/i.test(t)) return true;
  // Intención de CREAR vacante → no es "ver".
  if (/(necesito|contratar|contrata|requiero|publicar|solicitud)/i.test(t)) return false;
  const mencionaTrab = /(trabajador|personal|recolector|jornalero|obrero|gente)/i.test(t);
  const accionVer = /(ver|mostrar|mu[eé]str|disponible|quien|quién|cu[aá]les|list|tienes|ten[eé]s|hay)/i.test(t);
  return mencionaTrab && accionVer;
}

/** Nombre corto para el teaser (primer nombre + inicial del apellido) — privacidad. */
function nombreCorto(nombre) {
  const parts = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Trabajador';
  const inicial = parts[1] ? ` ${parts[1][0].toUpperCase()}.` : '';
  return parts[0] + inicial;
}

/**
 * Muestra al EMPLEADOR los trabajadores con 40%+ de coincidencia (mismo puntaje que la app),
 * como teaser de texto. Para contactarlos debe entrar a la app (por seguridad: no se
 * comparten teléfonos ni datos de contacto por WhatsApp).
 */
async function enviarTrabajadores(destino, empleador) {
  const { obtenerTrabajadoresMatch } = require('../controllers/trabajadoresController');
  const lista = await obtenerTrabajadoresMatch(empleador.id, { minPuntaje: 40, limite: 6 }).catch((e) => {
    console.error('[WhatsApp] obtenerTrabajadoresMatch:', e.message);
    return [];
  });

  if (!lista || lista.length === 0) {
    return {
      reply:
        '🔎 Por ahora no encontré trabajadores con *40%* o más de coincidencia con tu perfil o vacante.\n\n' +
        'Publica una solicitud con *Necesito trabajadores* para afinar la búsqueda, o revisa todos los perfiles en la app 👉 ' +
        LINK_APP,
    };
  }

  const lineas = lista.map((t, i) => {
    const lugar = [t.municipio, t.departamento].filter(Boolean).join(', ') || 'Colombia';
    const estrellas = t.total_calificaciones > 0
      ? `⭐ ${t.calificacion_promedio.toFixed(1)} (${t.total_calificaciones})`
      : '⭐ Sin calificaciones aún';
    const exp = t.anios_experiencia ? ` · ${t.anios_experiencia} año(s) exp.` : '';
    const skills = (t.habilidades || []).slice(0, 3).join(', ');
    return (
      `*${i + 1}. ${nombreCorto(t.nombre_completo)}* — ${t.puntaje_match}% de match\n` +
      `   📍 ${lugar}${exp}\n` +
      `   ${estrellas}` +
      (skills ? `\n   🛠️ ${skills}` : '')
    );
  });

  return {
    reply:
      `👷 *Trabajadores que encajan contigo (40%+):*\n\n${lineas.join('\n\n')}\n\n` +
      `🔒 Por seguridad, para *contactarlos* entra a la app TerraEmpleo y ábrelos desde ahí:\n👉 ${LINK_APP}`,
  };
}

// Preguntas del flujo de registro (orden común + ramas por rol).
const PREG_REG = {
  rol: '¿Qué eres? Responde *TRABAJADOR* (buscas trabajo) o *EMPLEADOR* (tienes finca/empresa).',
  nombre: '😊 ¿Cuál es tu *nombre completo*?',
  celular: '📱 ¿Cuál es tu *número de celular*? (ej: 3001234567)',
  cedula: '🪪 ¿Cuál es tu *número de cédula*?',
  municipio: '📍 ¿En qué *municipio o vereda* estás?',
  cultivos: '🌱 ¿Qué *cultivos* manejas? (ej: café, plátano, aguacate — sepáralos con comas)',
  labores: '🛠️ ¿Qué *labores* sabes hacer? (ej: recolección, guadaña, siembra)',
  disponibilidad: '🕒 ¿Cuál es tu *disponibilidad*? (tiempo completo / por días / temporada de cosecha)',
  finca: '🏡 ¿Cómo se llama tu *finca o empresa*?',
  tipo_pago: '💵 ¿Cómo pagas normalmente? (jornal / semanal / quincenal / por kilo)',
  habeas: `Para crear tu cuenta debes aceptar el tratamiento de datos (política: ${LINK_HABEAS}).\nResponde *ACEPTO* para continuar.`,
  password: '🔐 Por último, crea una *contraseña* para entrar a la app (mínimo 6 caracteres). Escríbela aquí.',
};

/** Inserta el split de una lista separada por comas en una tabla hija. */
async function insertarLista(texto, sql, mapFn) {
  const items = String(texto || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  for (const it of items) {
    await query(sql, mapFn(it)).catch(() => {});
  }
}

/**
 * Crea un usuario "a medias" desde WhatsApp (pendiente de aprobación). Devuelve
 * { ok, usuarioId, claveTemp, motivo }. La selfie/cédula se completan en la app.
 */
async function crearUsuarioDesdeWhatsapp(datos, jid) {
  const bcrypt = require('bcryptjs');
  const { normalizePhone } = require('../helpers/normalizePhone');
  const celDigits = String(datos.celular || '').replace(/\D/g, '');
  // Mismo formato E.164 (+57...) que usa el registro de la app → el login lo encuentra.
  const celNorm = normalizePhone(datos.celular) || (celDigits.length === 10 ? '+57' + celDigits : '+' + celDigits);
  // ¿Ya existe?
  const existe = await query(
    `SELECT id FROM usuarios WHERE RIGHT(REPLACE(REPLACE(celular,'+',''),' ',''),10) = ? LIMIT 1`,
    [celDigits.slice(-10)]
  ).catch(() => []);
  if (existe && existe[0]) {
    if (jid) await guardarIdentidad(jid, existe[0].id);
    return { ok: false, motivo: 'ya_existe', usuarioId: existe[0].id };
  }

  // Contraseña elegida por el usuario (mín 6). Si faltara, se genera una temporal.
  const clave = (datos.password && String(datos.password).length >= 6)
    ? String(datos.password)
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  const hash = await bcrypt.hash(clave, 10);
  const rol = datos.rol === 'empleador' ? 'empleador' : 'trabajador';

  const res = await query(
    `INSERT INTO usuarios (rol, nombre_completo, celular, password_hash, cedula, municipio,
       acepta_habeas_data, verificado_sms, whatsapp_opt_in, whatsapp_opt_in_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1, NOW())`,
    [rol, datos.nombre || 'Sin nombre', celNorm, hash, datos.cedula || '', datos.municipio || null]
  );
  const usuarioId = Number(res.insertId);

  if (rol === 'trabajador') {
    const pr = await query('INSERT INTO perfil_trabajador (usuario_id, disponibilidad) VALUES (?, ?)',
      [usuarioId, datos.disponibilidad || null]);
    const perfilId = Number(pr.insertId);
    await insertarLista(datos.cultivos, 'INSERT INTO trabajador_cultivos (perfil_trabajador_id, cultivo) VALUES (?, ?)', (c) => [perfilId, c]);
    await insertarLista(datos.labores, 'INSERT INTO trabajador_habilidades (perfil_trabajador_id, habilidad) VALUES (?, ?)', (l) => [perfilId, l]);
  } else {
    const pr = await query('INSERT INTO perfil_empleador (usuario_id, nombre_empresa_finca, tipo_pago) VALUES (?, ?, ?)',
      [usuarioId, datos.finca || 'Mi finca', datos.tipo_pago || null]);
    const perfilId = Number(pr.insertId);
    await insertarLista(datos.cultivos, 'INSERT INTO empleador_cultivos (perfil_empleador_id, cultivo) VALUES (?, ?)', (c) => [perfilId, c]);
    await insertarLista(datos.labores, 'INSERT INTO empleador_labores (perfil_empleador_id, labor) VALUES (?, ?)', (l) => [perfilId, l]);
  }

  if (jid) await guardarIdentidad(jid, usuarioId);
  return { ok: true, usuarioId, claveTemp: clave };
}

/** Fija la contraseña (bcrypt) de un usuario. Devuelve {ok} o {ok:false, motivo}. */
async function setPasswordUsuario(usuarioId, plain) {
  const pass = String(plain || '').trim();
  if (pass.length < 6) return { ok: false, motivo: 'corta' };
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(pass, 10);
  await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, usuarioId]);
  return { ok: true };
}

/**
 * Inicia el flujo del empleador, intentando prellenar con NLU (Bedrock). Devuelve
 * el reply inicial y crea la conversación. Si NLU no está disponible, arranca guiado.
 */
async function iniciarFlujoEmpleador(telefono, usuario, _textoLibre) {
  // Arranque guiado y determinístico. La IA (Bedrock) se usa UNA sola vez al final,
  // en el paso de confirmación, para pulir/corregir el resumen.
  const id = await crearConversacion(telefono, usuario.id, FLUJO_EMPLEADOR, 'finca');
  return {
    reply: `${saludoAsistente(usuario)} Te ayudo a publicar una solicitud de trabajadores.\n\n${PREGUNTAS.finca}`,
    conversacionId: id,
  };
}

/**
 * Punto de entrada del webhook. Procesa un mensaje entrante y devuelve el texto
 * de respuesta (o null si no hay que responder). Persiste el estado de la conversación.
 *
 * @param {object} p
 * @param {string} p.telefono  número normalizado (solo dígitos)
 * @param {string|null} p.jid  JID crudo del remitente (puede ser @lid)
 * @param {string} p.texto     texto del mensaje entrante
 * @param {object|null} p.usuario  fila de usuarios asociada (o null si no se reconoce)
 * @param {{buffer:Buffer,mimetype:string}|null} p.media  imagen adjunta (paso de fotos)
 * @returns {Promise<{reply: string|null, optOut?: boolean}>}
 */
async function procesarMensaje({ telefono, jid = null, texto, usuario, media = null }) {
  const comando = normalizarComando(texto);
  const upper = comando.toUpperCase();

  // ── Comando global: opt-out ───────────────────────────────────────────────
  if (upper === 'SALIR' || upper === 'STOP' || upper === 'BAJA') {
    if (usuario) await whatsappService.setOptIn(usuario.id, false);
    const conv = await getConversacionActiva(telefono);
    if (conv) await actualizarConversacion(conv.id, { estado: 'cancelada' });
    return {
      reply: 'Listo, no recibirás más mensajes de TerraEmpleo por WhatsApp. ' +
        'Si cambias de opinión, escríbenos cuando quieras. 🌱',
      optOut: true,
    };
  }

  // Alcanzable por WhatsApp: a cualquier usuario reconocido que interactúe lo marcamos
  // opt-in (una vez) para poder enviarle recordatorios de ofertas/matches.
  if (usuario && !usuario.whatsapp_opt_in) {
    whatsappService.setOptIn(usuario.id, true).catch(() => {});
    usuario.whatsapp_opt_in = 1;
  }

  const conv = await getConversacionActiva(telefono);

  // ── Comando global: cancelar flujo activo ─────────────────────────────────
  if (conv && (upper === 'CANCELAR' || upper === 'CANCEL')) {
    await actualizarConversacion(conv.id, { estado: 'cancelada' });
    return { reply: 'Solicitud cancelada. Escribe *Necesito trabajadores* cuando quieras crear una nueva.' };
  }

  // ── Sin conversación activa: decidir si arrancamos un flujo ───────────────
  if (!conv) {
    const textoLower = comando.toLowerCase();
    const esEmpleador = usuario && (usuario.rol === 'empleador' || usuario.rol === 'admin');
    const pareceInicio = PALABRAS_INICIO.some((p) => textoLower.includes(p));
    const pareceSoporte = PALABRAS_SOPORTE.some((p) => textoLower.includes(p));
    const pareceOfertas = PALABRAS_OFERTAS.some((p) => textoLower.includes(p));
    const pareceRegistro = PALABRAS_REGISTRO.some((p) => textoLower.includes(p));
    const pareceSaludo = PALABRAS_SALUDO.some((p) => textoLower === p || textoLower.startsWith(p + ' ') || textoLower.startsWith(p + ','));
    const pareceClave = PALABRAS_CLAVE.some((p) => textoLower.includes(p));
    const pareceVerTrab = pareceVerTrabajadores(textoLower);
    const pareceCuaderno = PALABRAS_CUADERNO.some((p) => textoLower.includes(p));
    const pareceContrate = PALABRAS_CONTRATE.some((p) => textoLower.includes(p));

    // 0.3) PASO 4 — el trabajador responde SÍ/NO a una oferta de vacante enviada por WhatsApp.
    //       Va ANTES de soporte porque "no puedo" también es palabra de soporte; solo actúa si el
    //       trabajador tiene una oferta pendiente (match_auto). Match exacto normalizado (sin acentos).
    if (usuario && usuario.rol === 'trabajador') {
      const limpio = textoLower.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

      // PASO 5 — confirmación de asistencia tras ser aceptado: "CONFIRMO" o "VOY".
      if (['confirmo', 'confirmar', 'confirmado', 'confirmada', 'confirmo asistencia', 'confirmo mi asistencia', 'voy', 'si voy', 'alli estare', 'ahi estare'].includes(limpio)) {
        const { confirmarAsistenciaTrabajador } = require('../controllers/vacantesController');
        const rc = await confirmarAsistenciaTrabajador(usuario.id).catch(() => ({ ok: false }));
        if (rc && rc.ok) {
          return { reply: `✅ ¡Confirmado! El empleador ya sabe que cuentas para *${rc.titulo}*. Llega puntual y mucha suerte 🌱` };
        }
        // Sin aceptación pendiente de confirmar → sigue el flujo normal (p. ej. "voy" como sí a una oferta).
      }

      // PASO 5 — respondió "NO VOY" al recordatorio: no asistirá → avisar al empleador (reemplazo).
      if (['no voy', 'no ire', 'no puedo ir', 'no voy a poder', 'no voy a poder ir', 'no asistire', 'no podre asistir', 'no podre ir'].includes(limpio)) {
        const { marcarNoAsiste } = require('../controllers/vacantesController');
        const rn = await marcarNoAsiste(usuario.id).catch(() => ({ ok: false }));
        if (rn && rn.ok) {
          return { reply: 'Entendido 👍 Avisamos al empleador para que busque un reemplazo. Recuerda que las ausencias afectan tu calificación en TerraEmpleo.' };
        }
        // Sin aceptación vigente → sigue el flujo normal (p. ej. "no voy" como rechazo de una oferta).
      }

      const SI_OFERTA = ['si', 'sisi', 'si quiero', 'si acepto', 'acepto', 'dale', 'listo', 'voy', 'claro', 'ok', 'okay', 'vale', 'quiero', 'me interesa', '1'];
      const NO_OFERTA = ['no', 'nel', 'paso', 'no puedo', 'no me interesa', 'no gracias', 'no voy', '2'];
      const afirmativo = SI_OFERTA.includes(limpio);
      const negativo = NO_OFERTA.includes(limpio);
      if (afirmativo || negativo) {
        const { responderOfertaTrabajador } = require('../controllers/vacantesController');
        const r = await responderOfertaTrabajador(usuario.id, afirmativo).catch(() => ({ ok: false }));
        if (r && r.ok) {
          return {
            reply: r.acepta
              ? `✅ ¡Listo! Enviamos tu interés en *${r.titulo}* al empleador. Si te acepta, te avisamos por aquí para coordinar. 🌱`
              : `Entendido 👍 No te postulamos a *${r.titulo}*. Te seguimos avisando de otras oportunidades cerca de ti.`,
          };
        }
        // Sin oferta pendiente → sigue el flujo normal (soporte, saludo, fallback...).
      }
    }

    // 0.5) Respuesta al seguimiento semanal: "CONTRATÉ" → dejar de recordar esa vacante (empleador).
    if (esEmpleador && pareceContrate) {
      const r = await detenerSeguimientoVacante(usuario.id);
      if (r.ok) {
        return { reply: `¡Felicidades! 🎉 No te recordaré más la vacante *${r.titulo}*. Gestiónala en la app cuando quieras 👉 ${LINK_APP}` };
      }
      return { reply: 'No tienes vacantes en seguimiento ahora mismo. Si necesitas gente escribe *Necesito trabajadores*, o *Ver trabajadores* para ver candidatos. 🌱' };
    }

    // 1) Soporte tiene prioridad: cualquiera puede pedir ayuda humana.
    if (pareceSoporte) {
      const id = await crearConversacion(telefono, usuario ? usuario.id : null, FLUJO_SOPORTE, 'describir');
      return { reply: soporteIntro(), conversacionId: id };
    }

    // 1.55) Embudo del Cuaderno Digital (venta del Plan Control). Disponible a cualquiera.
    //       DEMO/PRECIO/ACTIVAR se manejan DENTRO del flujo (no como comandos globales).
    if (pareceCuaderno) {
      const id = await crearConversacion(telefono, usuario ? usuario.id : null, FLUJO_CUADERNO, 'menu');
      return { reply: CUADERNO_INFO, conversacionId: id };
    }

    // 1.6) Ver trabajadores disponibles (empleador): top match 40%+, contacto en la app.
    //      Va ANTES del flujo de crear vacante para distinguir "ver" de "necesito".
    if (pareceVerTrab) {
      if (esEmpleador) {
        return await enviarTrabajadores(jid || telefono, usuario);
      }
      if (usuario && usuario.rol === 'trabajador') {
        return { reply: 'Esa opción es para empleadores 🌱. Si buscas trabajo, escribe *OFERTAS* para ver las vacantes disponibles.' };
      }
      // No reconocido: por seguridad, primero verificar que sea un empleador registrado.
      const id = await crearConversacion(telefono, null, FLUJO_IDENT, 'celular');
      await actualizarConversacion(id, { datos: { intencion: 'ver_trabajadores' } });
      return {
        reply:
          'Para ver trabajadores necesitas una cuenta de *empleador* en TerraEmpleo (por seguridad). 🔒\n\n' +
          'Envíame el *número de celular* con el que te registraste como empleador (ej: 3001234567), ' +
          'o escribe *REGISTRARME* si eres nuevo.',
        conversacionId: id,
      };
    }

    // 1.5) Crear / cambiar contraseña (para poder entrar a la app).
    if (pareceClave) {
      if (usuario) {
        const id = await crearConversacion(telefono, usuario.id, FLUJO_CLAVE, 'nueva');
        return { reply: '🔐 Escribe la *nueva contraseña* para entrar a la app (mínimo 6 caracteres).', conversacionId: id };
      }
      return { reply: 'No encontré una cuenta con este número. Si eres nuevo escribe *REGISTRARME* para crear tu cuenta. 🌱' };
    }

    // 2) Empleador reconocido con intención de contratar → flujo de solicitud.
    if (esEmpleador && pareceInicio) {
      return await iniciarFlujoEmpleador(telefono, usuario, comando);
    }

    // 3) Ver ofertas disponibles (cualquiera) — un mensaje por oferta con foto.
    if (pareceOfertas) {
      return await enviarOfertas(jid || telefono);
    }

    // 4) Registro de número nuevo (no reconocido) que quiere inscribirse.
    if (!usuario && pareceRegistro) {
      const id = await crearConversacion(telefono, null, FLUJO_REGISTRO, 'rol');
      return { reply: `${registroBienvenida()}\n\n${PREG_REG.rol}`, conversacionId: id };
    }

    // 5) NO reconocido (típico @lid) con intención de CONTRATAR → identificación de empleador.
    if (!usuario && pareceInicio) {
      const id = await crearConversacion(telefono, null, FLUJO_IDENT, 'celular');
      return {
        reply:
          'Para publicar una solicitud necesito verificar tu cuenta de TerraEmpleo. 🌱\n\n' +
          'Envíame el *número de celular* con el que te registraste como empleador (ej: 3001234567). ' +
          '\nSi eres nuevo, escribe *REGISTRARME*.',
        conversacionId: id,
      };
    }

    // 6) Saludo (cualquiera): bienvenida personalizada por nombre + menú según rol.
    if (pareceSaludo) {
      return { reply: bienvenidaPersonal(usuario) };
    }

    if (usuario && usuario.rol === 'trabajador') {
      if (upper === '1') {
        return { reply: pick(['¡Genial! Abre la app TerraEmpleo para postularte y ver los detalles. 🌱', '¡De una! 🙌 Entra a la app para postularte y ver el detalle.']) };
      }
      if (upper === '2') {
        return { reply: pick(['Entendido, no te postulamos a esa vacante. Te avisaremos cuando haya otra que encaje. 👍', 'Listo 👍 No te postulamos a esa. Te aviso cuando salga otra para ti.']) };
      }
      // No encajó en nada: que la IA ayude o escale (degrada a menú variado).
      return { reply: await fallbackInteligente({ usuario, telefono, comando, esTrabajador: true }) };
    }

    // No registrado o sin intención clara → fallback inteligente (o menú variado).
    return { reply: await fallbackInteligente({ usuario, telefono, comando, esTrabajador: false }) };
  }

  // ── Conversación activa: flujo del empleador ──────────────────────────────
  if (conv.flujo === FLUJO_EMPLEADOR) {
    const datos = parseDatos(conv.datos);
    const paso = conv.paso;

    switch (paso) {
      case 'finca':
        datos.finca = limpiarRespuesta(comando);
        await actualizarConversacion(conv.id, { paso: 'labor', datos });
        return { reply: PREGUNTAS.labor, conversacionId: conv.id };

      case 'labor':
        datos.labor = limpiarRespuesta(comando);
        await actualizarConversacion(conv.id, { paso: 'cantidad', datos });
        return { reply: PREGUNTAS.cantidad, conversacionId: conv.id };

      case 'cantidad': {
        const n = parseInt(comando.replace(/\D/g, ''), 10);
        if (!n || n < 1) {
          return { reply: 'Por favor envía un número válido de trabajadores (ej: 8).', conversacionId: conv.id };
        }
        datos.cantidad = n;
        await actualizarConversacion(conv.id, { paso: 'fecha', datos });
        return { reply: PREGUNTAS.fecha, conversacionId: conv.id };
      }

      case 'fecha': {
        const f = parseFechaJornada(comando);
        if (!f) {
          return { reply: 'No entendí la fecha 🙏. Escribe *HOY*, *MAÑANA* o la fecha como *DD/MM* (ej: 25/07).', conversacionId: conv.id };
        }
        datos.fecha = f.display;
        datos.fecha_jornada = f.iso;
        await actualizarConversacion(conv.id, { paso: 'hora', datos });
        return { reply: PREGUNTAS.hora, conversacionId: conv.id };
      }

      case 'hora':
        datos.hora = limpiarRespuesta(comando).slice(0, 20);
        await actualizarConversacion(conv.id, { paso: 'pago', datos });
        return { reply: PREGUNTAS.pago, conversacionId: conv.id };

      case 'pago': {
        const monto = parseInt(comando.replace(/\D/g, ''), 10);
        if (!monto || monto < 1000) {
          return { reply: 'Por favor envía el pago por jornada en pesos (ej: 70000).', conversacionId: conv.id };
        }
        datos.pago = monto;
        await actualizarConversacion(conv.id, { paso: 'descripcion', datos });
        return { reply: PREGUNTAS.descripcion, conversacionId: conv.id };
      }

      case 'descripcion':
        datos.descripcion = comando;
        datos.fotos = [];
        await actualizarConversacion(conv.id, { paso: 'fotos', datos });
        return { reply: PREGUNTAS.fotos, conversacionId: conv.id };

      case 'fotos': {
        if (media && media.buffer) {
          const { subirBuffer } = require('../config/s3');
          const url = await subirBuffer(media.buffer, 'vacantes', media.mimetype).catch(() => null);
          datos.fotos = Array.isArray(datos.fotos) ? datos.fotos : [];
          if (url) datos.fotos.push(url);
          await actualizarConversacion(conv.id, { datos });
          const n = datos.fotos.length;
          return {
            reply: url
              ? `📷 Foto ${n} recibida. Envía otra (máx 4) o escribe *LISTO* para publicar.`
              : 'No pude procesar esa imagen. Intenta de nuevo o escribe *LISTO*.',
            conversacionId: conv.id,
          };
        }
        if (upper === 'LISTO' || upper === 'OMITIR' || upper === 'NINGUNA' || upper === 'NO') {
          return await irAConfirmar(conv, datos);
        }
        return { reply: 'Envía una *foto* o escribe *LISTO* para continuar.', conversacionId: conv.id };
      }

      case 'confirmar': {
        if (upper === 'CONFIRMAR' || upper === 'SI' || upper === 'SÍ') {
          const { vacanteId, monto } = await crearVacanteDesdeWhatsapp(conv.usuario_id, datos);
          await actualizarConversacion(conv.id, { estado: 'completada', datos });
          return {
            reply:
              `✅ ¡Solicitud publicada! (vacante #${vacanteId})\n\n` +
              'Estamos avisando a los trabajadores cuyo perfil encaja. ' +
              'Abre la app TerraEmpleo para ver quiénes se postulan y contactarlos.',
            conversacionId: conv.id,
            vacanteCreada: vacanteId,
          };
        }
        if (upper === 'CORREGIR' || upper === 'NO') {
          await actualizarConversacion(conv.id, { paso: 'finca', datos: {} });
          return { reply: 'Sin problema, empecemos de nuevo.\n\n' + PREGUNTAS.finca, conversacionId: conv.id };
        }
        return { reply: sufijoConfirmar(), conversacionId: conv.id };
      }

      default:
        // Estado inconsistente: reiniciar.
        await actualizarConversacion(conv.id, { paso: 'finca', datos: {} });
        return { reply: PREGUNTAS.finca, conversacionId: conv.id };
    }
  }

  // ── Conversación activa: identificación de empleador ─────────────────────
  if (conv.flujo === FLUJO_IDENT) {
    const u = await matchUsuarioPorCelular(comando);
    if (!u) {
      return {
        reply:
          'No encontré ese número registrado como empleador en TerraEmpleo. ' +
          'Verifica el número e inténtalo de nuevo, o regístrate primero en la app. ' +
          '(Escribe *CANCELAR* para salir.)',
        conversacionId: conv.id,
      };
    }
    // Guardar el mapeo JID → usuario, marcar opt-in y cerrar la identificación.
    await guardarIdentidad(jid, u.id);
    await whatsappService.setOptIn(u.id, true).catch(() => {});
    await actualizarConversacion(conv.id, { estado: 'completada' });
    const primerNombre = (u.nombre_completo || '').split(' ')[0] || '';

    // Si venía a VER trabajadores, mostrar la lista (no arrancar creación de vacante).
    const datosIdent = parseDatos(conv.datos);
    if (datosIdent.intencion === 'ver_trabajadores') {
      const r = await enviarTrabajadores(jid || telefono, u);
      r.reply = `✅ ¡Listo, ${primerNombre}! Te reconocí.\n\n` + (r.reply || '');
      return r;
    }

    // Por defecto: arrancar el flujo de empleador de inmediato (ya identificado).
    const r = await iniciarFlujoEmpleador(telefono, u, '');
    r.reply = `✅ ¡Listo, ${primerNombre}! Te reconocí.\n\n` + (r.reply || '');
    return r;
  }

  // ── Conversación activa: registro de número nuevo ────────────────────────
  if (conv.flujo === FLUJO_REGISTRO) {
    const datos = parseDatos(conv.datos);
    switch (conv.paso) {
      case 'rol': {
        const r = upper.includes('EMPLE') ? 'empleador' : (upper.includes('TRABAJ') ? 'trabajador' : null);
        if (!r) return { reply: 'Responde *TRABAJADOR* o *EMPLEADOR*.', conversacionId: conv.id };
        datos.rol = r;
        await actualizarConversacion(conv.id, { paso: 'nombre', datos });
        return { reply: PREG_REG.nombre, conversacionId: conv.id };
      }
      case 'nombre':
        datos.nombre = limpiarRespuesta(comando);
        await actualizarConversacion(conv.id, { paso: 'celular', datos });
        return { reply: PREG_REG.celular, conversacionId: conv.id };
      case 'celular': {
        const cel = comando.replace(/\D/g, '');
        if (cel.length < 10) return { reply: 'Envía un celular válido de 10 dígitos (ej: 3001234567).', conversacionId: conv.id };
        datos.celular = cel;
        await actualizarConversacion(conv.id, { paso: 'cedula', datos });
        return { reply: PREG_REG.cedula, conversacionId: conv.id };
      }
      case 'cedula': {
        const ced = comando.replace(/\D/g, '');
        if (ced.length < 5) return { reply: 'Envía un número de cédula válido.', conversacionId: conv.id };
        datos.cedula = ced;
        await actualizarConversacion(conv.id, { paso: 'municipio', datos });
        return { reply: PREG_REG.municipio, conversacionId: conv.id };
      }
      case 'municipio':
        datos.municipio = limpiarRespuesta(comando);
        if (datos.rol === 'empleador') {
          await actualizarConversacion(conv.id, { paso: 'finca', datos });
          return { reply: PREG_REG.finca, conversacionId: conv.id };
        }
        await actualizarConversacion(conv.id, { paso: 'cultivos', datos });
        return { reply: PREG_REG.cultivos, conversacionId: conv.id };
      case 'finca':
        datos.finca = limpiarRespuesta(comando);
        await actualizarConversacion(conv.id, { paso: 'cultivos', datos });
        return { reply: PREG_REG.cultivos, conversacionId: conv.id };
      case 'cultivos':
        datos.cultivos = comando;
        await actualizarConversacion(conv.id, { paso: 'labores', datos });
        return { reply: PREG_REG.labores, conversacionId: conv.id };
      case 'labores':
        datos.labores = comando;
        if (datos.rol === 'empleador') {
          await actualizarConversacion(conv.id, { paso: 'tipo_pago', datos });
          return { reply: PREG_REG.tipo_pago, conversacionId: conv.id };
        }
        await actualizarConversacion(conv.id, { paso: 'disponibilidad', datos });
        return { reply: PREG_REG.disponibilidad, conversacionId: conv.id };
      case 'disponibilidad':
        datos.disponibilidad = mapDisponibilidad(comando);
        await actualizarConversacion(conv.id, { paso: 'habeas', datos });
        return { reply: PREG_REG.habeas, conversacionId: conv.id };
      case 'tipo_pago':
        datos.tipo_pago = mapTipoPago(comando);
        await actualizarConversacion(conv.id, { paso: 'habeas', datos });
        return { reply: PREG_REG.habeas, conversacionId: conv.id };
      case 'habeas': {
        if (!['ACEPTO', 'SI', 'SÍ', 'ACEPTAR'].includes(upper)) {
          return { reply: 'Para crear tu cuenta responde *ACEPTO* (o *CANCELAR* para salir).', conversacionId: conv.id };
        }
        await actualizarConversacion(conv.id, { paso: 'password', datos });
        return { reply: PREG_REG.password, conversacionId: conv.id };
      }
      case 'password': {
        if (comando.trim().length < 6) {
          return { reply: '🔐 La contraseña debe tener al menos 6 caracteres. Escríbela de nuevo.', conversacionId: conv.id };
        }
        datos.password = comando.trim();
        const r = await crearUsuarioDesdeWhatsapp(datos, jid);
        await actualizarConversacion(conv.id, { estado: 'completada', datos: { ...datos, password: undefined } });
        if (!r.ok && r.motivo === 'ya_existe') {
          return { reply: `Ya tienes una cuenta con ese número. Si olvidaste tu clave, escribe *CONTRASEÑA* y te ayudo. Entra a la app 👉 ${LINK_APP}`, conversacionId: conv.id };
        }
        // Trabajador nuevo → buscarle vacantes que encajen y avisarle por WhatsApp (background).
        if (r.ok && datos.rol === 'trabajador') {
          const { ejecutarMatchingParaTrabajador } = require('../controllers/vacantesController');
          ejecutarMatchingParaTrabajador(r.usuarioId).catch((e) => console.error('[WhatsApp] match registro:', e.message));
        }
        const celMostrar = String(datos.celular || '').replace(/\D/g, '');
        const queSigue = datos.rol === 'trabajador'
          ? 'Te avisaré ofertas por aquí. Para *postularte* y terminar tu registro (foto y cédula), entra a la app.'
          : 'Ya puedes publicar solicitudes por aquí (escribe *Necesito trabajadores*). Termina tu perfil en la app.';
        return {
          reply:
            `✅ ¡Listo, ${(datos.nombre || '').split(' ')[0]}! Tu cuenta quedó creada (pendiente de aprobación).\n\n` +
            `📲 Entra a la app con:\n   • Usuario (celular): *${celMostrar}*\n   • Tu contraseña\n   ${LINK_APP}\n\n${queSigue}`,
          conversacionId: conv.id,
        };
      }
      default:
        await actualizarConversacion(conv.id, { estado: 'cancelada' });
        return { reply: 'Reiniciemos. Escribe *REGISTRARME* para crear tu cuenta.', conversacionId: conv.id };
    }
  }

  // ── Conversación activa: crear/cambiar contraseña ────────────────────────
  if (conv.flujo === FLUJO_CLAVE) {
    const r = await setPasswordUsuario(conv.usuario_id, comando);
    if (!r.ok) {
      return { reply: '🔐 La contraseña debe tener al menos 6 caracteres. Escríbela de nuevo.', conversacionId: conv.id };
    }
    await actualizarConversacion(conv.id, { estado: 'completada' });
    const u = await query('SELECT celular FROM usuarios WHERE id = ?', [conv.usuario_id]).catch(() => []);
    const cel = u && u[0] ? String(u[0].celular).replace(/\D/g, '') : '';
    return {
      reply:
        `✅ ¡Contraseña actualizada! Entra a la app con:\n   • Usuario (celular): *${cel}*\n   • Tu nueva contraseña\n   ${LINK_APP}\n\nPuedes cambiarla luego desde la app.`,
      conversacionId: conv.id,
    };
  }

  // ── Conversación activa: flujo de soporte ────────────────────────────────
  if (conv.flujo === FLUJO_SOPORTE) {
    await escalarSoporte(usuario, telefono, comando);
    await actualizarConversacion(conv.id, { estado: 'completada' });
    return { reply: soporteCierre(), conversacionId: conv.id };
  }

  // ── Conversación activa: embudo del Cuaderno Digital ─────────────────────
  if (conv.flujo === FLUJO_CUADERNO) {
    const quiereDemo = upper.includes('DEMO');
    const quierePrecio = upper.includes('PRECIO') || upper.includes('PLAN') || upper.includes('PLANES') || upper.includes('COSTO') || upper.includes('CUANTO') || upper.includes('CUÁNTO');
    const quiereActivar = upper.includes('ACTIVAR');

    switch (conv.paso) {
      case 'menu':
        if (quiereDemo) {
          await actualizarConversacion(conv.id, { paso: 'demo_horario' });
          return { reply: CUADERNO_DEMO, conversacionId: conv.id };
        }
        if (quierePrecio) {
          await actualizarConversacion(conv.id, { paso: 'precio' });
          return { reply: CUADERNO_PRECIO, conversacionId: conv.id };
        }
        return { reply: '¿Le muestro cómo funciona? Escriba *DEMO* para agendar una visita o *PRECIO* para conocer los planes. 🌱', conversacionId: conv.id };

      case 'precio':
        if (quiereActivar) {
          await actualizarConversacion(conv.id, { paso: 'activar_numero' });
          return { reply: CUADERNO_ACTIVAR, conversacionId: conv.id };
        }
        if (quiereDemo) {
          await actualizarConversacion(conv.id, { paso: 'demo_horario' });
          return { reply: CUADERNO_DEMO, conversacionId: conv.id };
        }
        return { reply: 'Para empezar hoy con el *Plan Control* escriba *ACTIVAR*, o *DEMO* si prefiere una demostración primero. 🌱', conversacionId: conv.id };

      case 'demo_horario':
        await registrarLeadCuaderno(usuario, telefono, 'demo', comando);
        await actualizarConversacion(conv.id, { estado: 'completada' });
        return {
          reply: '¡Listo! ✅ Un asesor lo contactará en ese horario para la demostración. Gracias por su interés 🌱',
          conversacionId: conv.id,
        };

      case 'activar_numero':
        await registrarLeadCuaderno(usuario, telefono, 'activar', comando);
        await actualizarConversacion(conv.id, { estado: 'completada' });
        return {
          reply: '¡Perfecto! ✅ Lo llamamos a ese número para activar su Cuaderno. Bienvenido a TerraEmpleo 🌱',
          conversacionId: conv.id,
        };

      default:
        await actualizarConversacion(conv.id, { estado: 'completada' });
        return { reply: CUADERNO_INFO, conversacionId: conv.id };
    }
  }

  return { reply: null };
}

module.exports = {
  procesarMensaje,
  // exportados para pruebas
  crearVacanteDesdeWhatsapp,
  crearUsuarioDesdeWhatsapp,
  setPasswordUsuario,
  enviarOfertas,
  enviarTrabajadores,
  pareceVerTrabajadores,
  nombreCorto,
  registrarLeadCuaderno,
  detenerSeguimientoVacante,
  parseFechaJornada,
  limpiarRespuesta,
  FLUJO_EMPLEADOR,
  FLUJO_REGISTRO,
  FLUJO_CLAVE,
  FLUJO_CUADERNO,
  CUADERNO_INFO,
  CUADERNO_DEMO,
  CUADERNO_PRECIO,
  CUADERNO_ACTIVAR,
  PASOS,
};

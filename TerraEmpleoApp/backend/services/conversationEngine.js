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

// Pasos del flujo del empleador, en orden.
const PASOS = ['finca', 'labor', 'cantidad', 'fecha', 'pago', 'descripcion', 'fotos', 'confirmar'];

// Enlaces públicos.
const LINK_VACANTE = 'https://app.terrampleo.com/app/vacantes/';
const LINK_APP = 'https://www.terraempleo.com.co';
const LINK_HABEAS = 'https://app.terrampleo.com/privacidad.html';

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
  fecha: '📅 ¿Para qué día los necesitas? (ej: mañana, 15 de junio)',
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

const PALABRAS_INICIO = [
  'necesito', 'nueva solicitud', 'solicitud', 'publicar', 'trabajadores',
  'recolectores', 'busco', 'requiero', 'empezar', 'hola',
];

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
    : `Solicitud por WhatsApp · ${datos.cantidad || '-'} trabajador(es) · Fecha: ${datos.fecha || '-'}`;

  const result = await query(
    `INSERT INTO vacantes
       (empleador_id, titulo, descripcion, tipo_pago, monto_pago, departamento, municipio, vereda, urgente)
     VALUES (?, ?, ?, 'jornal', ?, ?, ?, ?, 1)`,
    [empleadorId, titulo, desc, monto, departamento, municipio, datos.finca || null]
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
    `💵 Pago por jornada: ${pago}\n\n` +
    'Responde *CONFIRMAR* para publicarla o *CORREGIR* para empezar de nuevo.'
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
    ? `${rev.resumen}\n\nResponde *CONFIRMAR* para publicarla o *CORREGIR* para empezar de nuevo.`
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
  const celular = String(datos.celular || '').replace(/\D/g, '');
  const celNorm = celular.length === 10 ? '57' + celular : celular;
  // ¿Ya existe?
  const existe = await query(
    `SELECT id FROM usuarios WHERE RIGHT(REPLACE(REPLACE(celular,'+',''),' ',''),10) = ? LIMIT 1`,
    [celular.slice(-10)]
  ).catch(() => []);
  if (existe && existe[0]) {
    if (jid) await guardarIdentidad(jid, existe[0].id);
    return { ok: false, motivo: 'ya_existe', usuarioId: existe[0].id };
  }

  const claveTemp = Math.random().toString(36).slice(2, 8).toUpperCase();
  const hash = await bcrypt.hash(claveTemp, 10);
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
  return { ok: true, usuarioId, claveTemp };
}

/**
 * Inicia el flujo del empleador, intentando prellenar con NLU (Bedrock). Devuelve
 * el reply inicial y crea la conversación. Si NLU no está disponible, arranca guiado.
 */
async function iniciarFlujoEmpleador(telefono, usuario, _textoLibre) {
  // Arranque guiado y determinístico. La IA (Bedrock) se usa UNA sola vez al final,
  // en el paso de confirmación, para pulir/corregir el resumen.
  const id = await crearConversacion(telefono, usuario.id, FLUJO_EMPLEADOR, 'finca');
  const saludo = `Hola ${(usuario.nombre_completo || '').split(' ')[0] || ''} 👋 Soy el asistente de TerraEmpleo.`;
  return {
    reply: `${saludo} Te ayudo a publicar una solicitud de trabajadores.\n\n${PREGUNTAS.finca}`,
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

    // 1) Soporte tiene prioridad: cualquiera puede pedir ayuda humana.
    if (pareceSoporte) {
      const id = await crearConversacion(telefono, usuario ? usuario.id : null, FLUJO_SOPORTE, 'describir');
      return {
        reply:
          '🙋 Con gusto te ayudo. Cuéntame en una frase qué necesitas o cuál es el problema, ' +
          'y te respondo o te paso con un asesor.',
        conversacionId: id,
      };
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
      return {
        reply: '¡Bienvenido a TerraEmpleo! 🌱 Te ayudo a crear tu cuenta.\n\n' + PREG_REG.rol,
        conversacionId: id,
      };
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

    if (usuario && usuario.rol === 'trabajador') {
      if (upper === '1') {
        return { reply: '¡Genial! Abre la app TerraEmpleo para postularte y ver los detalles. 🌱' };
      }
      if (upper === '2') {
        return { reply: 'Entendido, no te postulamos a esa vacante. Te avisaremos cuando haya otra que encaje. 👍' };
      }
      return {
        reply:
          'Hola 👋 Soy el asistente de TerraEmpleo. Escribe *OFERTAS* para ver los trabajos disponibles, ' +
          'o abre la app para postularte. Te avisaré por aquí cuando haya algo que encaje con tu perfil.',
      };
    }

    // No registrado o sin intención clara.
    return {
      reply:
        'Hola 👋 Soy el asistente de TerraEmpleo.\n' +
        '• ¿Buscas trabajo? Escribe *OFERTAS* para ver vacantes, o *REGISTRARME* para crear tu cuenta.\n' +
        '• ¿Tienes finca y necesitas gente? Escribe *Necesito trabajadores*.',
    };
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

      case 'fecha':
        datos.fecha = limpiarRespuesta(comando);
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
        return { reply: 'Responde *CONFIRMAR* para publicar o *CORREGIR* para empezar de nuevo.', conversacionId: conv.id };
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
    // Arrancar el flujo de empleador de inmediato (ya identificado).
    const r = await iniciarFlujoEmpleador(telefono, u, '');
    r.reply = `✅ ¡Listo, ${ (u.nombre_completo || '').split(' ')[0] || '' }! Te reconocí.\n\n` + (r.reply || '');
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
        const r = await crearUsuarioDesdeWhatsapp(datos, jid);
        await actualizarConversacion(conv.id, { estado: 'completada', datos });
        if (!r.ok && r.motivo === 'ya_existe') {
          return { reply: `Ya tienes una cuenta con ese número. Entra a la app con tu celular 👉 ${LINK_APP}`, conversacionId: conv.id };
        }
        // Trabajador nuevo → buscarle vacantes que encajen y avisarle por WhatsApp (background).
        if (r.ok && datos.rol === 'trabajador') {
          const { ejecutarMatchingParaTrabajador } = require('../controllers/vacantesController');
          ejecutarMatchingParaTrabajador(r.usuarioId).catch((e) => console.error('[WhatsApp] match registro:', e.message));
        }
        const queSigue = datos.rol === 'trabajador'
          ? 'Te avisaré ofertas por aquí. Para *postularte* y terminar tu registro (foto y cédula), entra a la app.'
          : 'Ya puedes publicar solicitudes por aquí (escribe *Necesito trabajadores*). Termina tu perfil en la app.';
        return {
          reply:
            `✅ ¡Listo, ${(datos.nombre || '').split(' ')[0]}! Tu cuenta quedó creada (pendiente de aprobación).\n\n` +
            `🔑 Clave temporal: *${r.claveTemp}* (cámbiala en la app)\n` +
            `📲 Descarga la app: ${LINK_APP}\n\n${queSigue}`,
          conversacionId: conv.id,
        };
      }
      default:
        await actualizarConversacion(conv.id, { estado: 'cancelada' });
        return { reply: 'Reiniciemos. Escribe *REGISTRARME* para crear tu cuenta.', conversacionId: conv.id };
    }
  }

  // ── Conversación activa: flujo de soporte ────────────────────────────────
  if (conv.flujo === FLUJO_SOPORTE) {
    await escalarSoporte(usuario, telefono, comando);
    await actualizarConversacion(conv.id, { estado: 'completada' });
    return {
      reply: '¡Gracias! 🙌 Registré tu mensaje y un asesor de TerraEmpleo te contactará pronto por este mismo chat.',
      conversacionId: conv.id,
    };
  }

  return { reply: null };
}

module.exports = {
  procesarMensaje,
  // exportados para pruebas
  crearVacanteDesdeWhatsapp,
  crearUsuarioDesdeWhatsapp,
  enviarOfertas,
  limpiarRespuesta,
  FLUJO_EMPLEADOR,
  FLUJO_REGISTRO,
  PASOS,
};

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

// Pasos del flujo del empleador, en orden.
const PASOS = ['finca', 'labor', 'cantidad', 'fecha', 'pago', 'confirmar'];

// Palabras que disparan el flujo de soporte (atención humana).
const PALABRAS_SOPORTE = [
  'ayuda', 'soporte', 'problema', 'no puedo', 'no me deja', 'error', 'falla',
  'queja', 'reclamo', 'no funciona', 'asesor', 'humano',
];

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
};

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
  const descripcion =
    `Solicitud creada por WhatsApp.\n` +
    `Finca/vereda: ${datos.finca || '-'}\n` +
    `Trabajadores requeridos: ${datos.cantidad || '-'}\n` +
    `Fecha: ${datos.fecha || '-'}`;

  const result = await query(
    `INSERT INTO vacantes
       (empleador_id, titulo, descripcion, tipo_pago, monto_pago, departamento, municipio, vereda, urgente)
     VALUES (?, ?, ?, 'jornal', ?, ?, ?, ?, 1)`,
    [empleadorId, titulo, descripcion, monto, departamento, municipio, datos.finca || null]
  );
  const vacanteId = Number(result.insertId);

  if (datos.labor) {
    await query('INSERT INTO vacante_labores (vacante_id, labor) VALUES (?, ?)', [vacanteId, datos.labor]);
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

/**
 * Inicia el flujo del empleador, intentando prellenar con NLU (Bedrock). Devuelve
 * el reply inicial y crea la conversación. Si NLU no está disponible, arranca guiado.
 */
async function iniciarFlujoEmpleador(telefono, usuario, textoLibre) {
  let datos = {};
  const extraido = await nluService.extraerSolicitud(textoLibre).catch(() => null);
  if (extraido && extraido.confianza >= 0.4) {
    datos = {
      finca: extraido.finca || undefined,
      labor: extraido.labor || undefined,
      cantidad: extraido.cantidad || undefined,
      fecha: extraido.fecha || undefined,
      pago: extraido.pago || undefined,
    };
    // Quitar undefined para que siguientePasoFaltante funcione.
    Object.keys(datos).forEach((k) => datos[k] === undefined && delete datos[k]);
  }

  const paso = siguientePasoFaltante(datos);
  const id = await crearConversacion(telefono, usuario.id, FLUJO_EMPLEADOR, paso);
  await actualizarConversacion(id, { datos });

  const saludo = `Hola ${(usuario.nombre_completo || '').split(' ')[0] || ''} 👋 Soy el asistente de TerraEmpleo.`;
  if (paso === 'confirmar') {
    return { reply: `${saludo}\n\n${resumenSolicitud(datos)}`, conversacionId: id };
  }
  const intro = Object.keys(datos).length > 0
    ? `${saludo} Anoté lo que me diste. Me falta un dato:\n\n`
    : `${saludo} Te ayudo a publicar una solicitud de trabajadores.\n\n`;
  return { reply: intro + PREGUNTAS[paso], conversacionId: id };
}

/**
 * Punto de entrada del webhook. Procesa un mensaje entrante y devuelve el texto
 * de respuesta (o null si no hay que responder). Persiste el estado de la conversación.
 *
 * @param {object} p
 * @param {string} p.telefono  número normalizado (solo dígitos)
 * @param {string} p.texto     texto del mensaje entrante
 * @param {object|null} p.usuario  fila de usuarios asociada al número (o null si no registrado)
 * @returns {Promise<{reply: string|null, optOut?: boolean}>}
 */
async function procesarMensaje({ telefono, texto, usuario }) {
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

    // 2) Empleador con intención de contratar → flujo de solicitud (con NLU si está disponible).
    if (esEmpleador && pareceInicio) {
      return await iniciarFlujoEmpleador(telefono, usuario, comando);
    }

    if (usuario && usuario.rol === 'trabajador') {
      // Respuesta numérica suelta de un trabajador a una invitación de vacante (flujo 2).
      if (upper === '1') {
        return { reply: '¡Genial! Abre la app TerraEmpleo para postularte y ver los detalles. 🌱' };
      }
      if (upper === '2') {
        return { reply: 'Entendido, no te postulamos a esa vacante. Te avisaremos cuando haya otra que encaje. 👍' };
      }
      return {
        reply:
          'Hola 👋 Soy el asistente de TerraEmpleo. Te avisaré por aquí cuando haya trabajos que ' +
          'encajen con tu perfil. Abre la app para ver y postularte a las vacantes.',
      };
    }

    // No registrado o sin intención clara.
    return {
      reply:
        'Hola 👋 Soy el asistente de TerraEmpleo.\n' +
        'Si eres empleador, escribe *Necesito trabajadores* para publicar una solicitud.\n' +
        'Si buscas trabajo, descarga la app TerraEmpleo para registrarte.',
    };
  }

  // ── Conversación activa: flujo del empleador ──────────────────────────────
  if (conv.flujo === FLUJO_EMPLEADOR) {
    const datos = parseDatos(conv.datos);
    const paso = conv.paso;

    switch (paso) {
      case 'finca':
        datos.finca = comando;
        await actualizarConversacion(conv.id, { paso: 'labor', datos });
        return { reply: PREGUNTAS.labor, conversacionId: conv.id };

      case 'labor':
        datos.labor = comando;
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
        datos.fecha = comando;
        await actualizarConversacion(conv.id, { paso: 'pago', datos });
        return { reply: PREGUNTAS.pago, conversacionId: conv.id };

      case 'pago': {
        const monto = parseInt(comando.replace(/\D/g, ''), 10);
        if (!monto || monto < 1000) {
          return { reply: 'Por favor envía el pago por jornada en pesos (ej: 70000).', conversacionId: conv.id };
        }
        datos.pago = monto;
        await actualizarConversacion(conv.id, { paso: 'confirmar', datos });
        return { reply: resumenSolicitud(datos), conversacionId: conv.id };
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
  FLUJO_EMPLEADOR,
  PASOS,
};

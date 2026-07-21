import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 30000,
});

let authToken = null;
let _signOutHandler = null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function getAuthToken() {
  return authToken;
}

export function setGlobalSignOutHandler(fn) {
  _signOutHandler = fn;
}

// Cierra sesión automáticamente si el servidor rechaza el token (401)
// Excluye endpoints de auth para no interferir con login/recuperar contraseña
api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    const isAuthEndpoint = /\/(login|register|recuperar|cognito|sms)/.test(url);
    if (status === 401 && !isAuthEndpoint && _signOutHandler) {
      _signOutHandler();
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  enviarSMS: (celular) => api.post('/auth/sms/enviar', { celular }),
  verificarSMS: (celular, codigo) => api.post('/auth/sms/verificar', { celular, codigo }),
  solicitarRecuperacion: (celular) => api.post('/auth/cognito/forgot-password', { phone: celular }),
  verificarCodigoRecuperacion: (celular, codigo, metodo) => api.post('/auth/recuperar/verificar', { celular, codigo, metodo }),
  actualizarPasswordRecuperacion: (celular, reset_token, nueva_password) => api.post('/auth/recuperar/nueva-password', {
    celular,
    reset_token,
    nueva_password,
  }),
  solicitarRecuperacionEmail: (correo) => api.post('/auth/recuperar/solicitar-email', { correo }),
  getPerfil: () => api.get('/auth/perfil'),
  actualizarPerfil: (data) => api.put('/auth/perfil', data),
  subirFoto: (tipo, formData) => api.post(`/auth/fotos/${tipo}`, formData, {
    transformRequest: [(data) => data],
  }),
  // fetch (no axios) — axios no arma bien el boundary multipart en iOS/Android,
  // lo que hacía que las fotos de identidad del registro (selfie/cédula) se
  // perdieran silenciosamente antes de llegar al panel de admin.
  subirFotoIdentidad: async (tipo, uri) => {
    const form = new FormData();
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    if (typeof document !== 'undefined') {
      const blob = await fetch(uri).then(r => r.blob());
      form.append('foto', blob, `${tipo}_${Date.now()}.${ext}`);
    } else {
      form.append('foto', { uri, type: mime, name: `${tipo}_${Date.now()}.${ext}` });
    }
    const res = await fetch(`${api.defaults.baseURL}/auth/fotos/${tipo}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data, status: res.status } };
    return { data };
  },
  cambiarFotoPerfil: (formData) => api.post('/auth/cambiar-foto-perfil', formData, {
    transformRequest: [(data) => data],
  }),
  subirHojaVida: (formData) => api.post('/auth/hoja-vida', formData, {
    transformRequest: [(data) => data],
  }),
  reenviarVerificacion: () => api.post('/auth/verificacion/reenviar'),
  cambiarRolAEspecialista: () => api.post('/auth/cambiar-rol/especialista'),
  subirFotoFinca: async (uri) => {
    const form = new FormData();
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    if (typeof document !== 'undefined') {
      const blob = await fetch(uri).then(r => r.blob());
      form.append('foto', blob, `foto_finca_${Date.now()}.${ext}`);
    } else {
      form.append('foto', { uri, type: mime, name: `foto_finca_${Date.now()}.${ext}` });
    }
    const res = await fetch(`${api.defaults.baseURL}/auth/fotos-finca`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data, status: res.status } };
    return { data };
  },
  eliminarFotoFinca: (fotoId) => api.delete(`/auth/fotos-finca/${fotoId}`),
  subirFotoTrabajo: async (uri) => {
    const form = new FormData();
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    if (typeof document !== 'undefined') {
      const blob = await fetch(uri).then(r => r.blob());
      form.append('foto', blob, `foto_trabajo_${Date.now()}.${ext}`);
    } else {
      form.append('foto', { uri, type: mime, name: `foto_trabajo_${Date.now()}.${ext}` });
    }
    const res = await fetch(`${api.defaults.baseURL}/auth/fotos-trabajo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data, status: res.status } };
    return { data };
  },
  eliminarFotoTrabajo: (fotoId) => api.delete(`/auth/fotos-trabajo/${fotoId}`),
  agregarExperiencia: (data) => api.post('/auth/experiencias', data),
  eliminarExperiencia: (expId) => api.delete(`/auth/experiencias/${expId}`),
  eliminarCuenta: (motivo) => api.delete('/auth/cuenta', { data: { motivo } }),
};

// Cognito Auth
export const cognitoAPI = {
  register: (phoneNumber, password) => api.post('/auth/cognito/register', { phoneNumber, password }),
  confirmRegister: (phoneNumber, code) => api.post('/auth/cognito/confirm-register', { phoneNumber, code }),
  resendCode: (phoneNumber) => api.post('/auth/cognito/resend-code', { phoneNumber }),
  login: (phoneNumber, password) => api.post('/auth/cognito/login', { phoneNumber, password }),
  forgotPassword: (phone) => api.post('/auth/cognito/forgot-password', { phone }),
  confirmForgotPassword: (phone, code, newPassword) => api.post('/auth/cognito/confirm-forgot-password', {
    phone,
    code,
    newPassword,
  }),
};

// Vacantes
export const vacantesAPI = {
  crear: (data) => api.post('/vacantes', data),
  misVacantes: () => api.get('/vacantes/mis-vacantes'),
  listar: (params) => api.get('/vacantes', { params }),
  recomendadas: () => api.get('/vacantes/recomendadas'),
  detalle: (id) => api.get(`/vacantes/${id}`),
  postularse: (data) => api.post('/vacantes/postularse', data),
  misPostulaciones: () => api.get('/vacantes/mis-postulaciones/lista'),
  responderContacto: (id, accion) => api.put(`/vacantes/postulaciones/${id}/responder-contacto`, { accion }),
  verPostulaciones: (vacanteId) => api.get(`/vacantes/postulaciones/${vacanteId}`),
  actualizarPostulacion: (id, estado) => api.put(`/vacantes/postulaciones/${id}/estado`, { estado }),
  actualizar: (id, data) => api.put(`/vacantes/${id}`, data),
  cerrar: (id) => api.put(`/vacantes/${id}/cerrar`),
  subirFotos: async (vacanteId, formData) => {
    // fetch handles FormData+multipart boundary correctly on iOS/Android (Axios no lo hace bien)
    const res = await fetch(`${api.defaults.baseURL}/vacantes/${vacanteId}/fotos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data, status: res.status } };
    return { data };
  },
  eliminarFoto: (vacanteId, fotoId) => api.delete(`/vacantes/${vacanteId}/fotos/${fotoId}`),
  eliminar: (id) => api.delete(`/vacantes/${id}`),
};

// Calificaciones
export const calificacionesAPI = {
  calificar: (data) => api.post('/calificaciones', data),
  obtener: (usuarioId) => api.get(`/calificaciones/${usuarioId}`),
};

// Trabajadores
export const trabajadoresAPI = {
  listar: (params) => api.get('/trabajadores', { params }),
  recomendados: (params) => api.get('/trabajadores/recomendados', { params }),
  perfilPublico: (id) => api.get(`/trabajadores/${id}/perfil`),
  contactar: (id, data) => api.post(`/trabajadores/${id}/contactar`, data),
};

// Empleadores
export const empleadoresAPI = {
  perfilPublico: (id) => api.get(`/empleadores/${id}/perfil`),
};

// Especialistas
export const especialistasAPI = {
  listar: (params) => api.get('/especialistas', { params }),
  perfil: (id) => api.get(`/especialistas/${id}`),
  contactar: (id, data) => api.post(`/especialistas/${id}/contactar`, data),
  contactarDirecto: (id) => api.post(`/especialistas/${id}/contactar-directo`, {}),
  contactoEstado: (id) => api.get(`/especialistas/${id}/contacto-estado`),
  misSolicitudes: () => api.get('/especialistas/mis-solicitudes'),
  responderSolicitud: (id, accion) => api.put(`/especialistas/solicitudes/${id}/responder`, { accion }),
};

// Certificados
export const certificadosAPI = {
  listar: () => api.get('/certificados'),
  listarDeUsuario: (id) => api.get(`/certificados/usuario/${id}`),
  crear: async (nombre, entidad, anio, archivoUri, archivoNombre, archivoMime) => {
    const form = new FormData();
    form.append('nombre', nombre);
    if (entidad) form.append('entidad', entidad);
    if (anio) form.append('anio', String(anio));
    if (archivoUri) {
      if (typeof document !== 'undefined') {
        const blob = await fetch(archivoUri).then(r => r.blob());
        form.append('archivo', new File([blob], archivoNombre || 'cert.pdf', { type: archivoMime || 'application/pdf' }));
        const token = api.defaults.headers.common['Authorization']?.replace('Bearer ', '');
        const res = await fetch(`${api.defaults.baseURL}/certificados`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        return res.json();
      } else {
        form.append('archivo', { uri: archivoUri, name: archivoNombre || 'cert.pdf', type: archivoMime || 'application/pdf' });
      }
    }
    return api.post('/certificados', form, { transformRequest: [(d) => d] }).then(r => r.data);
  },
  eliminar: (id) => api.delete(`/certificados/${id}`),
};

// Notificaciones
export const notificacionesAPI = {
  listar: (params) => api.get('/notificaciones', params ? { params } : undefined),
  contarNoLeidas: () => api.get('/notificaciones/no-leidas'),
  marcarLeida: (id) => api.put(`/notificaciones/${id}/leer`),
  marcarTodasLeidas: () => api.put('/notificaciones/leer-todas'),
  guardarPushToken: (token) => api.put('/notificaciones/push-token', { token }),
};

// Chats
export const chatsAPI = {
  misChats: (params) => api.get('/chats', params ? { params } : undefined),
  getMensajes: (chatId, pageOrParams = 1) => {
    const params = typeof pageOrParams === 'object' && pageOrParams !== null
      ? pageOrParams
      : { page: pageOrParams };
    return api.get(`/chats/${chatId}/mensajes`, { params });
  },
  enviarMensaje: (chatId, mensaje) => api.post(`/chats/${chatId}/mensajes`, { mensaje }),
  enviarMedia: async (chatId, uri, tipo, duracionAudio = null) => {
    const form = new FormData();
    const ext = (uri.split('.').pop() || '').toLowerCase().split('?')[0];
    const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', m4a: 'audio/m4a', mp4: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', webm: 'audio/webm', ogg: 'audio/ogg', caf: 'audio/x-caf', mp3: 'audio/mpeg' };
    const mimeType = mimeTypes[ext] || (tipo === 'audio' ? 'audio/m4a' : 'image/jpeg');
    const nombre = `chat_${Date.now()}.${ext || (tipo === 'audio' ? 'm4a' : 'jpg')}`;
    if (typeof document !== 'undefined') {
      // Web: uri puede ser blob: o data:, hay que convertir a File
      const blob = await fetch(uri).then(r => r.blob());
      form.append('archivo', new File([blob], nombre, { type: mimeType }));
    } else {
      form.append('archivo', { uri, name: nombre, type: mimeType });
    }
    form.append('tipo', tipo);
    if (duracionAudio !== null) form.append('duracion_audio', String(duracionAudio));
    // fetch handles FormData+multipart boundary correctly on iOS/Android (Axios no lo hace bien)
    const res = await fetch(`${api.defaults.baseURL}/chats/${chatId}/mensajes/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data, status: res.status } };
    return { data };
  },
  // Encola un mensaje multimedia para envío diferido cuando no hay internet.
  // Copia el archivo a una carpeta interna persistente (outbox) y registra la
  // operación en SQLite. El sync orchestrator lo subirá al recuperar conexión.
  // Devuelve un mensaje optimista local con `_pending: true` para pintar al instante.
  encolarMediaOutbox: async (chatId, uri, tipo, duracionAudio = null) => {
    const { copiarAlOutbox } = require('../utils/mediaCache');
    const { outboxRepo } = require('../db/repos');
    const ext = (uri.split('.').pop() || (tipo === 'audio' ? 'm4a' : 'jpg')).toLowerCase();
    const { localPath } = await copiarAlOutbox(uri, ext);
    const opId = await outboxRepo.push('mensaje_media', {
      chatId, tipo, localPath, duracion: duracionAudio, ext,
    });
    return {
      mensaje: {
        id: -Date.now(),
        chat_id: chatId,
        tipo,
        archivo_url: localPath,
        duracion_audio: duracionAudio,
        created_at: new Date().toISOString(),
        _pending: true,
        _outbox_id: opId,
      },
    };
  },
  marcarLeidos: (chatId) => api.put(`/chats/${chatId}/mensajes/leer`),
  contarNoLeidos: () => api.get('/chats/no-leidos'),
  chatPorVacanteTrabajador: (vacanteId, trabajadorId) => api.get(`/chats/vacante/${vacanteId}/trabajador/${trabajadorId}`),
  // Resuelve chat por relaciones existentes sin cambiar APIs de negocio.
  // Si no existe en backend, retorna null para fail-safe en navegación.
  getOrCreateChatId: async ({ vacancyId, employerId, workerId } = {}) => {
    const { data } = await api.get('/chats');
    const chats = data?.chats || [];

    const byVacancy = vacancyId
      ? chats.find((c) => Number(c.vacante_id) === Number(vacancyId))
      : null;
    if (byVacancy?.id) return Number(byVacancy.id);

    const byUser = employerId || workerId
      ? chats.find((c) => Number(c.otro_usuario_id) === Number(employerId || workerId))
      : null;
    if (byUser?.id) return Number(byUser.id);

    return null;
  },
};

// Passkey / WebAuthn
export const passkeyAPI = {
  // Registro — cognitoToken es el AccessToken de Cognito (no el JWT de la app)
  registerStart: (cognitoToken) =>
    api.post('/auth/cognito/passkey/register/start', {}, {
      headers: { 'x-cognito-token': cognitoToken },
    }),
  registerFinish: (cognitoToken, credential) =>
    api.post('/auth/cognito/passkey/register/finish', { credential }, {
      headers: { 'x-cognito-token': cognitoToken },
    }),
  // Autenticación — no requiere token previo
  authStart: (phoneNumber) =>
    api.post('/auth/cognito/passkey/auth/start', { phoneNumber }),
  authFinish: (session, credential, phoneNumber) =>
    api.post('/auth/cognito/passkey/auth/finish', { session, credential, phoneNumber }),
};

// Admin
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsuarios: () => api.get('/admin/usuarios'),
  getUsuarioDetalle: (id) => api.get(`/admin/usuarios/${id}`),
  getCedulasPendientes: () => api.get('/admin/validaciones-identidad/pendientes'),
  getUsuarioDocumentosIdentidad: (id) => api.get(`/admin/usuarios/${id}/documentos-identidad`),
  revisarValidacionIdentidad: (id, estado, comentario) => api.put(`/admin/usuarios/${id}/validacion-identidad`, {
    estado,
    comentario,
  }),
  getVacantes: () => api.get('/admin/vacantes'),
  getPostulantesVacante: (vacanteId) => api.get(`/admin/vacantes/${vacanteId}/postulaciones`),
  updateUsuario: (id, data) => api.put('/admin/usuarios/' + id, data),
  deleteUsuario: (id) => api.delete('/admin/usuarios/' + id),
  updateVacante: (id, data) => api.put('/admin/vacantes/' + id, data),
  deleteVacante: (id) => api.delete('/admin/vacantes/' + id),
  dashboard: () => api.get('/admin/dashboard'),
  listarUsuarios: () => api.get('/admin/usuarios'),
  listarCedulasPendientes: () => api.get('/admin/validaciones-identidad/pendientes'),
  toggleUsuario: (id, activo) => api.put(`/admin/usuarios/${id}/toggle`, { activo }),
  eliminarUsuario: (id) => api.delete(`/admin/usuarios/${id}`),
  listarVacantes: () => api.get('/admin/vacantes'),
  eliminarVacante: (id) => api.delete(`/admin/vacantes/${id}`),
  eliminarEmpleador: (id) => api.delete(`/admin/empleadores/${id}`),
  listarPostulaciones: () => api.get('/admin/postulaciones'),
  getEmpresasPendientes: () => api.get('/admin/verificaciones-empresa/pendientes'),
  revisarVerificacionEmpresa: (id, estado, comentario) => api.put(`/admin/empleadores/${id}/verificacion-empresa`, { estado, comentario }),
  getReportes: (estado) => api.get('/admin/reportes', { params: estado ? { estado } : {} }),
  resolverReporte: (id, data) => api.put(`/admin/reportes/${id}`, data),
  getPqrs: (estado) => api.get('/admin/pqrs', { params: estado ? { estado } : {} }),
  responderPqrs: (id, data) => api.put(`/admin/pqrs/${id}`, data),
  getServicios: () => api.get('/admin/servicios'),
  updateServicio: (id, data) => api.put(`/admin/servicios/${id}`, data),
  deleteServicio: (id) => api.delete(`/admin/servicios/${id}`),
};

export const reportesAPI = {
  reportar: (data) => api.post('/reportes', data),
  bloquear: (usuario_id) => api.post('/reportes/bloquear', { usuario_id }),
  desbloquear: (usuario_id) => api.delete(`/reportes/bloquear/${usuario_id}`),
};

export const pqrsAPI = {
  enviar: (data) => api.post('/pqrs', data),
  misPqrs: () => api.get('/pqrs'),
  responderUsuario: (id, respuesta_usuario) => api.put(`/pqrs/${id}/responder`, { respuesta_usuario }),
};

export const serviciosAPI = {
  listar: () => api.get('/servicios-especialista'),
  misServicios: () => api.get('/servicios-especialista/mis-servicios'),
  detalle: (id) => api.get(`/servicios-especialista/${id}`),
  // Crea el servicio en JSON primero, luego sube fotos con fetch nativo
  crear: async (datos, fotos) => {
    const res = await api.post('/servicios-especialista', {
      titulo: datos.titulo,
      descripcion: datos.descripcion || null,
      cultivos: datos.cultivos || [],
      precio_desde: datos.precio_desde || null,
      precio_hasta: datos.precio_hasta || null,
      modalidad: datos.modalidad || null,
    });
    const servicioId = res.data?.id || res.data?.servicio?.id;
    if (servicioId && fotos?.length) {
      const token = api.defaults.headers.common['Authorization'];
      const baseURL = api.defaults.baseURL;
      for (let i = 0; i < Math.min(fotos.length, 4); i++) {
        const f = fotos[i];
        const ext = (f.uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const fd = new FormData();
        if (typeof document !== 'undefined') {
          const blob = await fetch(f.uri).then(r => r.blob());
          fd.append('foto', blob, `foto${i}.${ext}`);
        } else {
          fd.append('foto', { uri: f.uri, type: mime, name: `foto${i}.${ext}` });
        }
        await fetch(`${baseURL}/servicios-especialista/${servicioId}/fotos`, {
          method: 'POST', body: fd, headers: { Authorization: token },
        }).catch(() => {});
      }
    }
    return res;
  },
  editar: (id, datos) => api.put(`/servicios-especialista/${id}`, {
    titulo: datos.titulo,
    descripcion: datos.descripcion || null,
    cultivos: datos.cultivos || [],
    precio_desde: datos.precio_desde || null,
    precio_hasta: datos.precio_hasta || null,
    modalidad: datos.modalidad || null,
    activo: datos.activo !== undefined ? datos.activo : 1,
  }),
  archivar: (id, activo) => api.put(`/servicios-especialista/${id}`, { activo }),
  eliminar: (id) => api.delete(`/servicios-especialista/${id}`),
  agregarFoto: async (servicioId, fotoUri) => {
    const ext = (fotoUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const token = api.defaults.headers.common['Authorization'];
    const baseURL = api.defaults.baseURL;
    const fd = new FormData();
    if (typeof document !== 'undefined') {
      const blob = await fetch(fotoUri).then(r => r.blob());
      fd.append('foto', blob, `foto.${ext}`);
    } else {
      fd.append('foto', { uri: fotoUri, type: mime, name: `foto.${ext}` });
    }
    const res = await fetch(`${baseURL}/servicios-especialista/${servicioId}/fotos`, {
      method: 'POST', body: fd, headers: { Authorization: token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data, status: res.status } };
    return { data };
  },
  eliminarFoto: (servicioId, fotoId) => api.delete(`/servicios-especialista/${servicioId}/fotos/${fotoId}`),
};

// Finca (finca cafetera — sub-usuarios, auditoría, config)
export const fincaAPI = {
  misFincas: () => api.get('/finca/mis-fincas'),
  crear: (data) => api.post('/finca', data),
  detalle: (id) => api.get(`/finca/${id}`),
  actualizar: (id, data) => api.put(`/finca/${id}`, data),
  auditoria: (id, params) => api.get(`/finca/${id}/auditoria`, params ? { params } : undefined),
  listarUsuarios: (id) => api.get(`/finca/${id}/usuarios`),
  invitarUsuario: (id, data) => api.post(`/finca/${id}/usuarios`, data),
  crearCuentaUsuario: (id, data) => api.post(`/finca/${id}/usuarios/crear-cuenta`, data),
  quitarUsuario: (id, fuId) => api.delete(`/finca/${id}/usuarios/${fuId}`),
  listarLotesFinca: (id) => api.get(`/finca/${id}/lotes`),
  crearLoteFinca: (id, data) => api.post(`/finca/${id}/lotes`, data),
  eliminarLoteFinca: (id, loteId) => api.delete(`/finca/${id}/lotes/${loteId}`),
  rendimientoLotes: (id, params) => api.get(`/finca/${id}/lotes/rendimiento`, { params }),
  rendimientoCultivos: (id, params) => api.get(`/finca/${id}/cultivos/rendimiento`, { params }),
  balance: (id, params) => api.get(`/finca/${id}/balance`, params ? { params } : undefined),
  crearMovimientoBalance: (id, data) => api.post(`/finca/${id}/balance/movimientos`, data),
  eliminarMovimientoBalance: (id, movId) => api.delete(`/finca/${id}/balance/movimientos/${movId}`),
};

// Cuaderno (jornadas, asistencias, registros, calificaciones, notas, dashboard)
export const cuadernoAPI = {
  dashboard: (params) => api.get('/cuaderno/dashboard', params ? { params } : undefined),
  postulantesVacante: (id) => api.get(`/cuaderno/vacantes/${id}/postulantes`),
  misTrabajadores: (params) => api.get('/cuaderno/mis-trabajadores', params ? { params } : undefined),
  crearTrabajadorExterno: (data) => api.post('/cuaderno/trabajadores-externos', data),
  historialTrabajador: (id, params) => api.get(`/cuaderno/trabajadores/${id}/historial`, params ? { params } : undefined),
  listarJornadas: (params) => api.get('/cuaderno/jornadas', params ? { params } : undefined),
  crearJornada: (data) => api.post('/cuaderno/jornadas', data),
  leerPlanilla: (imagenBase64) => api.post('/cuaderno/jornadas/leer-planilla', { imagen: imagenBase64 }),
  detalleJornada: (id) => api.get(`/cuaderno/jornadas/${id}`),
  actualizarJornada: (id, data) => api.put(`/cuaderno/jornadas/${id}`, data),
  eliminarJornada: (id) => api.delete(`/cuaderno/jornadas/${id}`),
  agregarAsistencia: (jornadaId, data) => api.post(`/cuaderno/jornadas/${jornadaId}/asistencias`, data),
  actualizarAsistencia: (asisId, data) => api.put(`/cuaderno/asistencias/${asisId}`, data),
  eliminarAsistencia: (asisId) => api.delete(`/cuaderno/asistencias/${asisId}`),
  upsertRegistro: (asisId, data) => api.put(`/cuaderno/asistencias/${asisId}/registro`, data),
  marcarPagado: (asisId, data) => api.put(`/cuaderno/asistencias/${asisId}/pago`, data),
  calificarAsistencia: (asisId, data) => api.put(`/cuaderno/asistencias/${asisId}/calificacion`, data),
  crearNota: (data) => api.post('/cuaderno/notas', data),
  eliminarNota: (id) => api.delete(`/cuaderno/notas/${id}`),
  // Nómina
  nomina: (params) => api.get('/cuaderno/nomina', { params }),
  leerNotaNomina: (params) => api.get('/cuaderno/nomina/nota', { params }),
  guardarNotaNomina: (data) => api.put('/cuaderno/nomina/nota', data),
  agregarAjuste: (asisId, data) => api.post(`/cuaderno/asistencias/${asisId}/ajustes`, data),
  eliminarAjuste: (id) => api.delete(`/cuaderno/ajustes/${id}`),
  // NOTA: el backend actual solo persiste firmado:boolean (columna firma_recibido),
  // no una imagen de firma — no existe endpoint de subida de imagen todavía.
  // Ver aviso en el resumen de esta tarea.
  marcarFirma: (asisId, data) => api.put(`/cuaderno/asistencias/${asisId}/firma`, data),
};

// Muro de mercado
export const muroAPI = {
  listar: (params) => api.get('/muro', params ? { params } : undefined),
  crear: async (data, fotoUri) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
    });
    if (fotoUri) {
      const ext = (fotoUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      if (typeof document !== 'undefined') {
        const blob = await fetch(fotoUri).then(r => r.blob());
        form.append('foto', blob, `muro_${Date.now()}.${ext}`);
      } else {
        form.append('foto', { uri: fotoUri, type: mime, name: `muro_${Date.now()}.${ext}` });
      }
    }
    const res = await fetch(`${api.defaults.baseURL}/muro`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data: resData, status: res.status } };
    return { data: resData };
  },
  actualizar: (id, data) => api.put(`/muro/${id}`, data),
  eliminar: (id) => api.delete(`/muro/${id}`),
  contactar: (id) => api.post(`/muro/${id}/contactar`),
};

// Café (lotes, conversión, alertas de merma)
export const cafeAPI = {
  preview: (params) => api.get('/cafe/preview', params ? { params } : undefined),
  alertas: (params) => api.get('/cafe/alertas', params ? { params } : undefined),
  listarLotes: (params) => api.get('/cafe/lotes', params ? { params } : undefined),
  crearLote: (data) => api.post('/cafe/lotes', data),
  detalleLote: (id) => api.get(`/cafe/lotes/${id}`),
  actualizarLote: (id, data) => api.put(`/cafe/lotes/${id}`, data),
  eliminarLote: (id) => api.delete(`/cafe/lotes/${id}`),
  registrarReal: (loteId, data) => api.post(`/cafe/lotes/${loteId}/real`, data),
  eliminarReal: (id) => api.delete(`/cafe/real/${id}`),
  gestionarAlerta: (loteId, data) => api.put(`/cafe/lotes/${loteId}/alerta`, data),
};

// Finanzas (tablero mensual, conceptos, movimientos, cierre de periodo)
export const finanzasAPI = {
  tablero: (params) => api.get('/finanzas/tablero', { params }),
  upsertMovimiento: (data) => api.put('/finanzas/movimientos', data),
  crearConcepto: (data) => api.post('/finanzas/conceptos', data),
  actualizarConcepto: (id, data) => api.put(`/finanzas/conceptos/${id}`, data),
  eliminarConcepto: (id) => api.delete(`/finanzas/conceptos/${id}`),
  cambiarEstadoPeriodo: (id, data) => api.put(`/finanzas/periodos/${id}/estado`, data),
  actualizarPrecioVenta: (id, data) => api.put(`/finanzas/periodos/${id}/precio-venta`, data),
  actualizarPrecioVentaCultivo: (id, data) => api.put(`/finanzas/periodos/${id}/precio-venta-cultivo`, data),
  listarPreciosVentaCultivo: (id) => api.get(`/finanzas/periodos/${id}/precios-venta-cultivo`),
  subirFotoMovimiento: async (movId, uri) => {
    const form = new FormData();
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    if (typeof document !== 'undefined') {
      const blob = await fetch(uri).then(r => r.blob());
      form.append('foto', blob, `factura_${Date.now()}.${ext}`);
    } else {
      form.append('foto', { uri, type: mime, name: `factura_${Date.now()}.${ext}` });
    }
    const res = await fetch(`${api.defaults.baseURL}/finanzas/movimientos/${movId}/foto`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { response: { data, status: res.status } };
    return { data };
  },
  eliminarFotoMovimiento: (movId) => api.delete(`/finanzas/movimientos/${movId}/foto`),
};

export default api;

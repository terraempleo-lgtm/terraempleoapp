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
  cambiarFotoPerfil: (formData) => api.post('/auth/cambiar-foto-perfil', formData, {
    transformRequest: [(data) => data],
  }),
  subirHojaVida: (formData) => api.post('/auth/hoja-vida', formData, {
    transformRequest: [(data) => data],
  }),
  reenviarVerificacion: () => api.post('/auth/verificacion/reenviar'),
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
  subirFotos: (vacanteId, formData) => api.post(`/vacantes/${vacanteId}/fotos`, formData, {
    transformRequest: [(data) => data],
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
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

// Notificaciones
export const notificacionesAPI = {
  listar: () => api.get('/notificaciones'),
  contarNoLeidas: () => api.get('/notificaciones/no-leidas'),
  marcarLeida: (id) => api.put(`/notificaciones/${id}/leer`),
  marcarTodasLeidas: () => api.put('/notificaciones/leer-todas'),
  guardarPushToken: (token) => api.put('/notificaciones/push-token', { token }),
};

// Chats
export const chatsAPI = {
  misChats: () => api.get('/chats'),
  getMensajes: (chatId, page = 1) => api.get(`/chats/${chatId}/mensajes`, { params: { page } }),
  enviarMensaje: (chatId, mensaje) => api.post(`/chats/${chatId}/mensajes`, { mensaje }),
  enviarMedia: (chatId, uri, tipo, duracionAudio = null) => {
    const form = new FormData();
    const ext = uri.split('.').pop().toLowerCase();
    const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', m4a: 'audio/m4a', mp4: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', webm: 'audio/webm', ogg: 'audio/ogg', caf: 'audio/x-caf', mp3: 'audio/mpeg' };
    const mimeType = mimeTypes[ext] || (tipo === 'audio' ? 'audio/m4a' : 'image/jpeg');
    form.append('archivo', { uri, name: `chat_${Date.now()}.${ext}`, type: mimeType });
    form.append('tipo', tipo);
    if (duracionAudio !== null) form.append('duracion_audio', String(duracionAudio));
    return api.post(`/chats/${chatId}/mensajes/media`, form);
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
};

export const reportesAPI = {
  reportar: (data) => api.post('/reportes', data),
  bloquear: (usuario_id) => api.post('/reportes/bloquear', { usuario_id }),
  desbloquear: (usuario_id) => api.delete(`/reportes/bloquear/${usuario_id}`),
};

export const pqrsAPI = {
  enviar: (data) => api.post('/pqrs', data),
  misPqrs: () => api.get('/pqrs'),
};

export default api;

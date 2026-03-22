import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 30000,
});

let authToken = null;

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
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  subirHojaVida: (formData) => api.post('/auth/hoja-vida', formData, {
    transformRequest: [(data) => data],
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
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
  perfilPublico: (id) => api.get(`/trabajadores/${id}/perfil`),
};

// Notificaciones
export const notificacionesAPI = {
  listar: () => api.get('/notificaciones'),
  contarNoLeidas: () => api.get('/notificaciones/no-leidas'),
  marcarLeida: (id) => api.put(`/notificaciones/${id}/leer`),
  marcarTodasLeidas: () => api.put('/notificaciones/leer-todas'),
};

// Chats
export const chatsAPI = {
  misChats: () => api.get('/chats'),
  getMensajes: (chatId, page = 1) => api.get(`/chats/${chatId}/mensajes`, { params: { page } }),
  enviarMensaje: (chatId, mensaje) => api.post(`/chats/${chatId}/mensajes`, { mensaje }),
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
};

export default api;

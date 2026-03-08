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
  getPerfil: () => api.get('/auth/perfil'),
  actualizarPerfil: (data) => api.put('/auth/perfil', data),
  subirFoto: (tipo, formData) => api.post(`/auth/fotos/${tipo}`, formData, {
    transformRequest: [(data) => data],
  }),
};

// Vacantes
export const vacantesAPI = {
  crear: (data) => api.post('/vacantes', data),
  misVacantes: () => api.get('/vacantes/mis-vacantes'),
  listar: (params) => api.get('/vacantes', { params }),
  detalle: (id) => api.get(`/vacantes/${id}`),
  postularse: (data) => api.post('/vacantes/postularse', data),
  misPostulaciones: () => api.get('/vacantes/mis-postulaciones/lista'),
  verPostulaciones: (vacanteId) => api.get(`/vacantes/postulaciones/${vacanteId}`),
  actualizarPostulacion: (id, estado) => api.put(`/vacantes/postulaciones/${id}/estado`, { estado }),
  actualizar: (id, data) => api.put(`/vacantes/${id}`, data),
  cerrar: (id) => api.put(`/vacantes/${id}/cerrar`),
  subirFotos: (vacanteId, formData) => api.post(`/vacantes/${vacanteId}/fotos`, formData, {
    transformRequest: [(data) => data], // Evita que Axios serialice el FormData; XHR pone el boundary automáticamente
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
};

// Admin
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsuarios: () => api.get('/admin/usuarios'),
  getVacantes: () => api.get('/admin/vacantes'),
  getPostulantesVacante: (vacanteId) => api.get(`/admin/vacantes/${vacanteId}/postulaciones`),
  updateUsuario: (id, data) => api.put('/admin/usuarios/' + id, data),
  deleteUsuario: (id) => api.delete('/admin/usuarios/' + id),
  updateVacante: (id, data) => api.put('/admin/vacantes/' + id, data),
  deleteVacante: (id) => api.delete('/admin/vacantes/' + id),
  dashboard: () => api.get('/admin/dashboard'),
  listarUsuarios: () => api.get('/admin/usuarios'),
  toggleUsuario: (id, activo) => api.put(`/admin/usuarios/${id}/toggle`, { activo }),
  eliminarUsuario: (id) => api.delete(`/admin/usuarios/${id}`),
  listarVacantes: () => api.get('/admin/vacantes'),
  eliminarVacante: (id) => api.delete(`/admin/vacantes/${id}`),
  listarPostulaciones: () => api.get('/admin/postulaciones'),
};

export default api;

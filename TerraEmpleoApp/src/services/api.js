import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'multipart/form-data' },
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
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  eliminarFoto: (vacanteId, fotoId) => api.delete(`/vacantes/${vacanteId}/fotos/${fotoId}`),
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

// Admin
export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  listarUsuarios: () => api.get('/admin/usuarios'),
  toggleUsuario: (id, activo) => api.put(`/admin/usuarios/${id}/toggle`, { activo }),
  eliminarUsuario: (id) => api.delete(`/admin/usuarios/${id}`),
  listarVacantes: () => api.get('/admin/vacantes'),
  eliminarVacante: (id) => api.delete(`/admin/vacantes/${id}`),
  listarPostulaciones: () => api.get('/admin/postulaciones'),
};

export default api;

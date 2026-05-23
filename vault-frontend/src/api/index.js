import axios from 'axios';

const BASE = 'http://127.0.0.1:8080/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vault_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  status: () => api.get('/auth/status'),
  setup: (master_password) => api.post('/auth/setup', { master_password }),
  unlock: (master_password) => api.post('/auth/unlock', { master_password }),
  lock: () => api.post('/auth/lock'),
};

export const entriesApi = {
  list: () => api.get('/entries'),
  get: (id) => api.get(`/entries/${id}`),
  create: (data) => api.post('/entries', data),
  update: (id, data) => api.put(`/entries/${id}`, data),
  delete: (id) => api.delete(`/entries/${id}`),
};

export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
};

export const utilApi = {
  generate: (params) => api.get('/generate', { params }),
  checkStrength: (password) => api.post('/strength', { password }),
  getAudit: () => api.get('/audit'),
  exportVault: (export_password) => api.post('/export', { export_password }),
  importVault: (data) => api.post('/import', data),
};

export default api;

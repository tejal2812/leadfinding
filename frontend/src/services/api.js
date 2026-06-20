import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('leadsutra_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('leadsutra_token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// ── Leads ─────────────────────────────────────────────────
export const leadsAPI = {
  list: (params) => api.get('/leads', { params }),
  get: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.patch(`/leads/${id}`, data),
  delete: (id, hard = false) => api.delete(`/leads/${id}`, { params: { hard } }),
  bulk: (data) => api.post('/leads/bulk', data),
  exportCSV: () => api.get('/leads/export/csv', { responseType: 'blob' }),
  importCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/leads/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  stats: () => api.get('/leads/stats/overview'),
};

// ── Discover ──────────────────────────────────────────────
export const discoverAPI = {
  search: (data) => api.post('/discover/search', data),
  save: (businesses) => api.post('/discover/save', { businesses }),
};

// ── Audit ─────────────────────────────────────────────────
export const auditAPI = {
  run: (data) => api.post('/audit/run', data),
  get: (id) => api.get(`/audit/${id}`),
  byLead: (leadId) => api.get(`/audit/lead/${leadId}`),
  history: (params) => api.get('/audit', { params }),
};

// ── Pitches ───────────────────────────────────────────────
export const pitchesAPI = {
  generate: (data) => api.post('/pitches/generate', data),
  list: (params) => api.get('/pitches', { params }),
  update: (id, data) => api.patch(`/pitches/${id}`, data),
  delete: (id) => api.delete(`/pitches/${id}`),
  send: (id) => api.post(`/pitches/${id}/send`),
};

// ── Outreach ──────────────────────────────────────────────
export const outreachAPI = {
  sequences: () => api.get('/outreach/sequences'),
  sequence: (id) => api.get(`/outreach/sequences/${id}`),
  createSequence: (data) => api.post('/outreach/sequences', data),
  updateSequence: (id, data) => api.patch(`/outreach/sequences/${id}`, data),
  deleteSequence: (id) => api.delete(`/outreach/sequences/${id}`),
  enroll: (id, leadIds) => api.post(`/outreach/sequences/${id}/enroll`, { lead_ids: leadIds }),
  stats: () => api.get('/outreach/stats'),
};

// ── Dashboard ─────────────────────────────────────────────
export const dashboardAPI = {
  overview: () => api.get('/dashboard/overview'),
};

// ── Settings ──────────────────────────────────────────────
export const settingsAPI = {
  updateProfile: (data) => api.patch('/settings/profile', data),
  updatePreferences: (data) => api.patch('/settings/preferences', data),
  changePassword: (data) => api.post('/settings/change-password', data),
};

// ── Billing ───────────────────────────────────────────────
export const billingAPI = {
  plans: () => api.get('/billing/plans'),
  checkout: (plan) => api.post('/billing/create-checkout-session', { plan }),
  portal: () => api.post('/billing/create-portal-session'),
  usage: () => api.get('/billing/usage'),
};

export default api;

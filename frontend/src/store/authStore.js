import { create } from 'zustand';
import { authAPI } from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('leadsutra_token'),
  loading: true,
  isAuthenticated: false,

  init: async () => {
    const token = localStorage.getItem('leadsutra_token');
    if (!token) { set({ loading: false }); return; }
    try {
      const { data } = await authAPI.me();
      set({ user: data, token, isAuthenticated: true, loading: false });
    } catch {
      localStorage.removeItem('leadsutra_token');
      set({ user: null, token: null, isAuthenticated: false, loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('leadsutra_token', data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
    return data.user;
  },

  register: async (payload) => {
    const { data } = await authAPI.register(payload);
    localStorage.setItem('leadsutra_token', data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
    return data.user;
  },

  logout: () => {
    localStorage.removeItem('leadsutra_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    const { data } = await authAPI.me();
    set({ user: data });
  },
}));

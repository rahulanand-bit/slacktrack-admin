import axios from 'axios';
import { clearSessionToken, getSessionToken } from '../auth/session';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
});

let redirectingToLogin = false;

apiClient.interceptors.request.use((config) => {
  const token = getSessionToken();
  const requestUrl = String(config.url || '');
  const isAdminApi = requestUrl.includes('/api/admin');
  const isAuthEndpoint = requestUrl.includes('/api/admin/auth/login');
  const currentPath = window.location.pathname;

  if (!token && isAdminApi && !isAuthEndpoint && currentPath !== '/login') {
    clearSessionToken();
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      window.location.assign('/login');
    }
    return Promise.reject(new Error('Missing authentication token'));
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || '');
    const isAuthEndpoint = requestUrl.includes('/api/admin/auth/login');
    const currentPath = window.location.pathname;

    if ((status === 401 || status === 403) && !isAuthEndpoint && currentPath !== '/login') {
      clearSessionToken();
      if (!redirectingToLogin) {
        redirectingToLogin = true;
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  }
);

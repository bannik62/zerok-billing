import axios from 'axios';
import { API } from '$lib/api.js';
import { getCsrfToken, fetchCsrfToken } from '$lib/csrf.js';

/**
 * Instance axios pour toutes les requêtes vers le backend.
 * - baseURL : API (ex. http://localhost:3011)
 * - withCredentials : true (cookie de session)
 * - Header X-CSRF-Token ajouté automatiquement sur POST, PUT, PATCH, DELETE
 */
export const apiClient = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head'].includes(method)) {
    const token = getCsrfToken();
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    if (err.response?.status === 403 && config && !config._csrfRetried) {
      const msg = err.response?.data?.error ?? '';
      if (typeof msg === 'string' && (msg.includes('CSRF') || msg.includes('csrf'))) {
        config._csrfRetried = true;
        await fetchCsrfToken().catch(() => null);
        const token = getCsrfToken();
        if (token) config.headers['X-CSRF-Token'] = token;
        return apiClient.request(config);
      }
    }
    return Promise.reject(err);
  }
);

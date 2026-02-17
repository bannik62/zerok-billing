import axios from 'axios';
import { API } from '$lib/api.js';
import { getCsrfToken } from '$lib/csrf.js';

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

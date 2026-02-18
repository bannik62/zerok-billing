/**
 * URL de base de l'API backend. Défaut : http://localhost:3011 (Docker BACKEND_PORT).
 * Override : VITE_API_URL dans frontend/.env
 */
const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
export const API = (envUrl != null && typeof envUrl === 'string') ? envUrl : 'http://localhost:3011';

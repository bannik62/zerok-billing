/**
 * URL de base de l'API backend zerok-billing (Express).
 * Docker : backend exposé sur l'hôte en 3011 (voir docker-compose BACKEND_PORT:-3011).
 * Pour un autre port : VITE_API_URL=http://localhost:XXXX dans .env
 */
const hasViteEnv = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL;
const envUrl = hasViteEnv ? import.meta.env.VITE_API_URL : null;
export const API = envUrl != null && typeof envUrl === 'string' ? envUrl : 'http://localhost:3011';

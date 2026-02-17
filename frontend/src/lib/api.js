/**
 * URL de base de l'API backend zerok-billing (Express).
 * Docker : backend exposé sur l'hôte en 3011 (voir docker-compose BACKEND_PORT:-3011).
 * Pour un autre port : VITE_API_URL=http://localhost:XXXX dans .env
 */
export const API =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3011';

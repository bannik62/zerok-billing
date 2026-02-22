/**
 * Logger minimal : en production, les messages de debug ne s'affichent pas.
 * Les erreurs sont toujours émises (console.error) pour le diagnostic.
 */
import { env } from '../config/env.js';

const isProd = env.isProduction;

export function log(...args) {
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

export function error(...args) {
  // En production, on peut brancher un vrai logger (fichier, service) ici.
  // eslint-disable-next-line no-console
  console.error(...args);
}

/**
 * Client API pour la sauvegarde serveur (GET/PUT backup).
 * Métier uniquement : pas d'UI.
 */

import { apiClient } from '$lib/apiClient.js';

/**
 * GET /api/backup — Récupère la sauvegarde serveur (blob chiffré).
 * Logique mise à jour ou pas : si stateHash est fourni et égal au stateHash stocké côté serveur,
 * le serveur renvoie { unchanged: true } sans blob (pas de téléchargement). Sinon il renvoie le blob.
 * @param {string|null} stateHash - Hash du bundle local ; null si IndexedDB vide (on veut toujours le blob si existant).
 * @returns {Promise<{ status: 200 | 404, unchanged?: boolean, payload?: string, stateHash?: string }>}
 */
export async function getBackup(stateHash = null) {
  const params = stateHash ? { hash: stateHash } : {};
  try {
    const res = await apiClient.get('/api/backup', { params });
    const data = res.data;
    if (data?.unchanged === true) {
      return { status: 200, unchanged: true };
    }
    return {
      status: 200,
      payload: typeof data?.payload === 'string' ? data.payload : undefined,
      stateHash: typeof data?.stateHash === 'string' ? data.stateHash : undefined
    };
  } catch (err) {
    if (err.response?.status === 404) return { status: 404 };
    throw err;
  }
}

/**
 * PUT /api/backup
 * @param {string} payload - Chaîne JSON de l'archive chiffrée
 * @param {string} stateHash - Hash canonique de l'état
 */
export async function putBackup(payload, stateHash) {
  await apiClient.put('/api/backup', { payload, stateHash });
}

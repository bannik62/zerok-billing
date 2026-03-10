import { writable } from 'svelte/store';
import { getBackupVersion } from '$lib/backupApi.js';

/**
 * Dernière version de backup connue côté client (vue depuis le serveur).
 * Utilisé uniquement pour comparer avec la version actuelle retournée par /api/backup/version.
 */
export const backupVersionStore = writable(
  /** @type {{ stateHash: string | null, updatedAt: string | null }} */ ({
    stateHash: null,
    updatedAt: null
  })
);

/**
 * Indique si une nouvelle version de backup serveur (créée possiblement sur un autre poste)
 * est disponible par rapport à ce que ce client a déjà vu.
 */
export const serverUpdateAvailableStore = writable(false);

let _pollIntervalId = /** @type {number | null} */ (null);
const POLL_INTERVAL_MS = 60000;

/**
 * Déclare qu'on connaît désormais le stateHash côté serveur (par ex. juste après un PUT réussi).
 * Cela évite qu'un poste voie sa propre mise à jour comme venant d'un autre poste.
 * @param {string | null | undefined} stateHash
 */
export function setKnownServerStateHash(_stateHash) {
  // Conservé pour compatibilité éventuelle, mais inutilisé depuis le passage à SSE-only.
}

/**
 * Lance un polling régulier sur /api/backup/version pour détecter les mises à jour du backup
 * (hash différent) sans télécharger le blob chiffré.
 * Idempotent : si déjà démarré, ne crée pas de second interval.
 */
export function startBackupVersionPolling() {
  // Polling désactivé : notifications temps réel via SSE (eventsClient).
}

/**
 * Stoppe le polling de version (à appeler au logout ou quand on quitte le menu).
 */
export function stopBackupVersionPolling() {
  // Polling désactivé.
}


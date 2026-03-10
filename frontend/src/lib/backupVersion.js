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
export function setKnownServerStateHash(stateHash) {
  const normalized = stateHash && typeof stateHash === 'string' ? stateHash : null;
  backupVersionStore.update((prev) => ({
    stateHash: normalized,
    updatedAt: prev?.updatedAt ?? null
  }));
  if (normalized == null) {
    serverUpdateAvailableStore.set(false);
  }
}

/**
 * Lance un polling régulier sur /api/backup/version pour détecter les mises à jour du backup
 * (hash différent) sans télécharger le blob chiffré.
 * Idempotent : si déjà démarré, ne crée pas de second interval.
 */
export function startBackupVersionPolling() {
  if (typeof window === 'undefined') return;
  if (_pollIntervalId != null) return;

  const tick = async () => {
    try {
      const result = await getBackupVersion();
      if (result.status !== 200 || !result.stateHash) {
        return;
      }
      backupVersionStore.update((prev) => {
        const prevHash = prev?.stateHash ?? null;
        const nextHash = result.stateHash ?? null;
        const nextUpdatedAt = result.updatedAt ?? null;

        // Première valeur connue : on initialise sans afficher de bannière.
        if (!prevHash && nextHash) {
          return { stateHash: nextHash, updatedAt: nextUpdatedAt };
        }

        // Changement de hash : une nouvelle version serveur est disponible.
        if (prevHash && nextHash && prevHash !== nextHash) {
          serverUpdateAvailableStore.set(true);
          return { stateHash: nextHash, updatedAt: nextUpdatedAt };
        }

        return { stateHash: nextHash, updatedAt: nextUpdatedAt };
      });
    } catch {
      // Erreurs réseau silencieuses : le prochain tick réessaiera.
    }
  };

  // Premier tick immédiat, puis intervalle régulier.
  void tick();
  _pollIntervalId = window.setInterval(tick, POLL_INTERVAL_MS);
}

/**
 * Stoppe le polling de version (à appeler au logout ou quand on quitte le menu).
 */
export function stopBackupVersionPolling() {
  if (typeof window === 'undefined') return;
  if (_pollIntervalId != null) {
    window.clearInterval(_pollIntervalId);
    _pollIntervalId = null;
  }
}


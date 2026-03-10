import { serverUpdateAvailableStore } from '$lib/backupVersion.js';

let _eventSource = /** @type {EventSource | null} */ (null);

export function startEventsStream() {
  if (typeof window === 'undefined') return;
  if (_eventSource) return;

  const es = new EventSource('/api/events');
  _eventSource = es;

  es.addEventListener('backupUpdated', () => {
    serverUpdateAvailableStore.set(true);
  });

  es.onerror = () => {
    // En cas d'erreur, on ferme et on laissera un prochain appel redémarrer.
    try {
      es.close();
    } catch {
      // ignore
    }
    _eventSource = null;
  };
}

export function stopEventsStream() {
  if (_eventSource) {
    try {
      _eventSource.close();
    } catch {
      // ignore
    }
    _eventSource = null;
  }
}


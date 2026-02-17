import { writable, get } from 'svelte/store';
import { API } from '$lib/api.js';

/** Store réactif : { token: string | null, loaded: boolean } */
export const csrfStore = writable({ token: null, loaded: false });

export function getCsrfToken() {
  return get(csrfStore).token;
}

/**
 * Récupère le token CSRF côté serveur et met à jour le store.
 * À appeler au chargement de l'app (ex. CsrfTemoin).
 */
export async function fetchCsrfToken() {
  try {
    const res = await fetch(`${API}/api/auth/csrf-token`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    let token = null;
    if (data && typeof data.csrfToken === 'string') token = data.csrfToken;
    else if (data && typeof data.csrf_token === 'string') token = data.csrf_token;
    if (res.ok && token && typeof token === 'string') {
      csrfStore.set({ token, loaded: true });
      return token;
    }
    csrfStore.set({ token: null, loaded: true });
    return null;
  } catch {
    csrfStore.set({ token: null, loaded: true });
    return null;
  }
}

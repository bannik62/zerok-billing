import { writable } from 'svelte/store';

/**
 * Indique si une nouvelle version de backup serveur (créée possiblement sur un autre poste)
 * est disponible par rapport à ce que ce client a déjà vu.
 */
export const serverUpdateAvailableStore = writable(false);

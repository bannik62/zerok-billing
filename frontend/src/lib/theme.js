/**
 * Thème jour/nuit : bouton bascule, persistance localStorage, pas de préférence système.
 * Applique data-theme="dark" | "light" sur document.documentElement.
 */

import { writable } from 'svelte/store';

const STORAGE_KEY = 'zerok-theme';

function getStored() {
  if (typeof localStorage === 'undefined') return 'light';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'dark' ? 'dark' : 'light';
}

function applyTheme(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = value;
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value);
}

function createThemeStore() {
  let value = getStored();
  applyTheme(value);
  const { subscribe, set: writableSet } = writable(value);
  return {
    subscribe,
    set(v) {
      value = v === 'dark' ? 'dark' : 'light';
      applyTheme(value);
      writableSet(value);
    },
    update(fn) {
      value = fn(value) === 'dark' ? 'dark' : 'light';
      applyTheme(value);
      writableSet(value);
    }
  };
}

export const themeStore = createThemeStore();

export function toggleTheme() {
  themeStore.update((v) => {
    const next = v === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  });
}

export function setTheme(value) {
  const v = value === 'dark' ? 'dark' : 'light';
  applyTheme(v);
  themeStore.set(v);
}

// Init au chargement (au cas où le store n'est pas souscrit tout de suite)
if (typeof document !== 'undefined') {
  applyTheme(getStored());
}

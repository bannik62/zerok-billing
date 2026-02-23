/**
 * Phrase de récupération : génération (wordlist) et normalisation.
 * Wordlist sans accent : normalisation enlève les accents pour matcher.
 */
import { apiClient } from '$lib/apiClient.js';

const RECOVERY_WORD_COUNT = 12;

/** Retourne la wordlist depuis le backend (tableau de strings). */
export async function fetchWordlist() {
  const res = await apiClient.get('/api/recovery/wordlist');
  const list = res.data;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Wordlist indisponible');
  }
  return list;
}

/**
 * Génère une phrase de 12 mots aléatoires (crypto.getRandomValues).
 * @param {string[]} wordlist - Liste de mots (sans accent)
 * @returns {string} - 12 mots séparés par un espace
 */
export function generateRecoveryPhrase(wordlist) {
  const n = wordlist.length;
  if (n === 0) throw new Error('Wordlist vide');
  const indices = new Uint32Array(RECOVERY_WORD_COUNT);
  crypto.getRandomValues(indices);
  const words = [];
  for (let i = 0; i < RECOVERY_WORD_COUNT; i++) {
    words.push(wordlist[indices[i] % n]);
  }
  return words.join(' ');
}

/**
 * Normalise la phrase saisie pour la comparaison / dérivation.
 * Wordlist sans accent : on enlève les accents, minuscules, trim, espaces multiples → un seul.
 * @param {string} phrase - Phrase saisie par l'utilisateur
 * @returns {string} - Phrase normalisée (mots séparés par un espace)
 */
export function normalizePhrase(phrase) {
  if (typeof phrase !== 'string') return '';
  let s = phrase
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  s = removeAccents(s);
  return s;
}

/**
 * Enlève les accents (pour matcher la wordlist sans accent).
 */
function removeAccents(s) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

import { writable, get } from 'svelte/store';

/**
 * Encapsule un champ de formulaire : getter/setter avec normalisation (trim, maxLength)
 * et validation (minLength, pattern). Utilise un store en interne pour la réactivité Svelte.
 *
 * Dans le template : value={$field.store} oninput={(e) => field.value = e.target.value}
 * À la soumission : utiliser field.value (déjà normalisé) et field.getError() pour la validation.
 */
export class FormField {
  /**
   * @param {Object} options
   * @param {number} [options.maxLength]
   * @param {number} [options.minLength]
   * @param {boolean} [options.trim=true]
   * @param {boolean} [options.required=false]
   * @param {RegExp} [options.pattern]
   * @param {string} [options.patternMessage]
   * @param {string} [options.initial='']
   * @param {string} [options.autocomplete] - ex. 'email', 'current-password'
   */
  constructor(options = {}) {
    this.maxLength = options.maxLength ?? null;
    this.minLength = options.minLength ?? 0;
    this.trim = options.trim !== false;
    this.required = options.required ?? false;
    this.pattern = options.pattern ?? null;
    this.patternMessage = options.patternMessage ?? 'Format invalide';
    this.autocomplete = options.autocomplete ?? null;
    this._store = writable(options.initial ?? '');
  }

  /** Store Svelte pour liaison réactive dans le template ($field.store) */
  get store() {
    return this._store;
  }

  get value() {
    return get(this._store);
  }

  set value(v) {
    let s = typeof v === 'string' ? v : '';
    if (this.trim) s = s.trim();
    if (this.maxLength != null && s.length > this.maxLength) s = s.slice(0, this.maxLength);
    this._store.set(s);
  }

  /**
   * Erreur de validation du champ seul (pas de règle croisée).
   * @returns {string|null} Message d'erreur ou null si valide
   */
  getError() {
    const v = this.value;
    if (this.required && v.length === 0) return 'Champ requis';
    if (this.minLength > 0 && v.length > 0 && v.length < this.minLength) {
      return `Minimum ${this.minLength} caractères`;
    }
    if (this.pattern && v.length > 0 && !this.pattern.test(v)) return this.patternMessage;
    return null;
  }

  /** true si le champ est valide (getError() === null) */
  get isValid() {
    return this.getError() === null;
  }

  /** Réinitialise le champ */
  reset(initial = '') {
    this._store.set(initial);
  }
}

/** Champ email (maxLength 255, trim, autocomplete email) */
export function createEmailField(initial = '') {
  return new FormField({
    maxLength: 255,
    trim: true,
    required: true,
    autocomplete: 'email',
    initial
  });
}

/** Champ mot de passe (maxLength 128, minLength 8, pas de trim, autocomplete) */
export function createPasswordField(initial = '', options = {}) {
  const { minLength = 8, autocomplete = 'current-password' } = options;
  return new FormField({
    maxLength: 128,
    minLength,
    trim: false,
    required: true,
    autocomplete,
    initial
  });
}

/** Champ texte libre (nom, prénom, adresse, etc.) */
export function createTextField(options = {}) {
  return new FormField({
    maxLength: options.maxLength ?? 255,
    trim: true,
    required: options.required ?? false,
    autocomplete: options.autocomplete ?? null,
    initial: options.initial ?? ''
  });
}

/** Champ URL (logo, lien) – maxLength 2048, trim */
export function createUrlField(initial = '') {
  return new FormField({
    maxLength: 2048,
    trim: true,
    required: false,
    initial
  });
}

/** Champ téléphone – maxLength 30, trim */
export function createTelField(options = {}) {
  return new FormField({
    maxLength: options.maxLength ?? 30,
    trim: true,
    required: options.required ?? false,
    initial: options.initial ?? ''
  });
}

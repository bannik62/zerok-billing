import { writable, get } from 'svelte/store';

/** Longueur max par défaut pour champs texte (email, nom, adresse, etc.). */
const DEFAULT_MAX_LENGTH = 255;
/** Longueur max pour mot de passe. */
const PASSWORD_MAX_LENGTH = 128;
/** Longueur max pour URL. */
const URL_MAX_LENGTH = 2048;
/** Longueur max par défaut pour téléphone. */
const TEL_DEFAULT_MAX_LENGTH = 30;
/** Longueur min pour mot de passe. */
const MIN_PASSWORD_LENGTH = 8;

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
    this.maxLength = options.maxLength != null ? options.maxLength : null;
    this.minLength = options.minLength != null ? options.minLength : 0;
    this.trim = options.trim !== false;
    this.required = options.required != null ? options.required : false;
    this.pattern = options.pattern != null ? options.pattern : null;
    this.patternMessage = options.patternMessage != null ? options.patternMessage : 'Format invalide';
    this.autocomplete = options.autocomplete != null ? options.autocomplete : null;
    const initial = options.initial != null ? options.initial : '';
    this._store = writable(initial);
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

/** Champ email (maxLength DEFAULT_MAX_LENGTH, trim, autocomplete email) */
export function createEmailField(initial = '') {
  return new FormField({
    maxLength: DEFAULT_MAX_LENGTH,
    trim: true,
    required: true,
    autocomplete: 'email',
    initial
  });
}

/** Champ mot de passe (maxLength PASSWORD_MAX_LENGTH, minLength MIN_PASSWORD_LENGTH, pas de trim) */
export function createPasswordField(initial = '', options = {}) {
  const minLength = options.minLength != null ? options.minLength : MIN_PASSWORD_LENGTH;
  const autocomplete = options.autocomplete != null ? options.autocomplete : 'current-password';
  return new FormField({
    maxLength: PASSWORD_MAX_LENGTH,
    minLength,
    trim: false,
    required: true,
    autocomplete,
    initial
  });
}

/** Champ texte libre (nom, prénom, adresse, etc.) */
export function createTextField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : DEFAULT_MAX_LENGTH;
  const required = options.required != null ? options.required : false;
  const autocomplete = options.autocomplete != null ? options.autocomplete : null;
  const initial = options.initial != null ? options.initial : '';
  return new FormField({ maxLength, trim: true, required, autocomplete, initial });
}

/** Champ URL (logo, lien) – maxLength URL_MAX_LENGTH, trim */
export function createUrlField(initial = '') {
  return new FormField({
    maxLength: URL_MAX_LENGTH,
    trim: true,
    required: false,
    initial
  });
}

/** Champ téléphone – maxLength TEL_DEFAULT_MAX_LENGTH, trim */
export function createTelField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : TEL_DEFAULT_MAX_LENGTH;
  const required = options.required != null ? options.required : false;
  const initial = options.initial != null ? options.initial : '';
  return new FormField({ maxLength, trim: true, required, initial });
}

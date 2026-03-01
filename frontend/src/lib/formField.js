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

/** Email : format xxx@yyy.zz */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_PATTERN_MESSAGE = 'Email invalide';

/** Champ email (maxLength DEFAULT_MAX_LENGTH, trim, pattern, autocomplete) */
export function createEmailField(initial = '') {
  return new FormField({
    maxLength: DEFAULT_MAX_LENGTH,
    trim: true,
    required: true,
    pattern: EMAIL_PATTERN,
    patternMessage: EMAIL_PATTERN_MESSAGE,
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

/** Nom / Prénom : lettres, espaces, tiret, apostrophe – pas de chiffres */
export const NOM_PRENOM_PATTERN = /^[^\d]+$/;
export const NOM_PRENOM_PATTERN_MESSAGE = 'Pas de chiffres autorisés';

/** Champ texte libre (nom, prénom, adresse, etc.) */
export function createTextField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : DEFAULT_MAX_LENGTH;
  const minLength = options.minLength != null ? options.minLength : 0;
  const required = options.required != null ? options.required : false;
  const autocomplete = options.autocomplete != null ? options.autocomplete : null;
  const initial = options.initial != null ? options.initial : '';
  const pattern = options.pattern != null ? options.pattern : null;
  const patternMessage = options.patternMessage != null ? options.patternMessage : 'Format invalide';
  return new FormField({ maxLength, minLength, trim: true, required, autocomplete, initial, pattern, patternMessage });
}

/** SIRET : 14 chiffres (espaces autorisés) */
export const SIRET_PATTERN = /^(\d\s?){14}$/;
export const SIRET_PATTERN_MESSAGE = 'SIRET : 14 chiffres requis';

/** TVA intracommunautaire FR : FR + 2 chiffres clé + 9 chiffres SIREN (espaces autorisés) */
export const TVA_INTRA_FR_PATTERN = /^FR\s*(\d\s?){11}$/;
export const TVA_INTRA_PATTERN_MESSAGE = 'TVA : FR + 11 chiffres (ex. FR12345678901)';

/** Capital social : au moins un chiffre, espaces, virgule/point, symbole € */
export const CAPITAL_PATTERN = /^[\d\s.,€]*\d[\d\s.,€]*$/;
export const CAPITAL_PATTERN_MESSAGE = 'Chiffres, espaces, virgule ou point, symbole €';

/** Champ SIRET (14 chiffres, espaces autorisés) */
export function createSiretField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : 20;
  const required = options.required != null ? options.required : false;
  const initial = options.initial != null ? options.initial : '';
  return new FormField({
    maxLength,
    trim: true,
    required,
    pattern: SIRET_PATTERN,
    patternMessage: SIRET_PATTERN_MESSAGE,
    initial
  });
}

/** Champ TVA intracommunautaire (FR + 11 chiffres) */
export function createTvaIntraField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : 30;
  const required = options.required != null ? options.required : false;
  const initial = options.initial != null ? options.initial : '';
  return new FormField({
    maxLength,
    trim: true,
    required,
    pattern: TVA_INTRA_FR_PATTERN,
    patternMessage: TVA_INTRA_PATTERN_MESSAGE,
    initial
  });
}

/** Champ capital social (chiffres, espaces, virgule, point, €) */
export function createCapitalField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : 100;
  const required = options.required != null ? options.required : false;
  const initial = options.initial != null ? options.initial : '';
  const pattern = options.pattern != null ? options.pattern : CAPITAL_PATTERN;
  const patternMessage = options.patternMessage != null ? options.patternMessage : CAPITAL_PATTERN_MESSAGE;
  return new FormField({
    maxLength,
    trim: true,
    required,
    pattern,
    patternMessage,
    initial
  });
}

/** URL : http(s):// ou data: (pour images base64) si non vide */
export const URL_PATTERN = /^(https?:\/\/\S+|data:[^,]+,\S+)$/;
export const URL_PATTERN_MESSAGE = 'URL invalide (https://… ou data:image/…)';

/** Champ URL (logo, lien) – maxLength URL_MAX_LENGTH, trim */
export function createUrlField(initial = '') {
  return new FormField({
    maxLength: URL_MAX_LENGTH,
    trim: true,
    required: false,
    pattern: URL_PATTERN,
    patternMessage: URL_PATTERN_MESSAGE,
    initial
  });
}

/** Téléphone : chiffres, espaces, +, -, ., () – min 10 caractères */
export const TEL_PATTERN = /^[\d\s.\-+()]{10,}$/;
export const TEL_PATTERN_MESSAGE = 'Téléphone : min. 10 caractères (chiffres, espaces, +, -)';

/** Code postal FR : 5 chiffres */
export const CODE_POSTAL_PATTERN = /^\d{5}$/;
export const CODE_POSTAL_PATTERN_MESSAGE = 'Code postal : 5 chiffres';

/** Champ téléphone – maxLength TEL_DEFAULT_MAX_LENGTH, trim, pattern */
export function createTelField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : TEL_DEFAULT_MAX_LENGTH;
  const required = options.required != null ? options.required : false;
  const initial = options.initial != null ? options.initial : '';
  return new FormField({
    maxLength,
    trim: true,
    required,
    pattern: TEL_PATTERN,
    patternMessage: TEL_PATTERN_MESSAGE,
    initial
  });
}

/** Champ code postal français (5 chiffres) */
export function createCodePostalField(options = {}) {
  const maxLength = options.maxLength != null ? options.maxLength : 10;
  const required = options.required != null ? options.required : false;
  const initial = options.initial != null ? options.initial : '';
  return new FormField({
    maxLength,
    trim: true,
    required,
    pattern: CODE_POSTAL_PATTERN,
    patternMessage: CODE_POSTAL_PATTERN_MESSAGE,
    initial
  });
}

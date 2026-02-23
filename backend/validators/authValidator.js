import Joi from 'joi';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  NOM_MAX_LENGTH,
  PRENOM_MAX_LENGTH,
  ADRESSE_MAX_LENGTH,
  RECOVERY_SALT_MAX_LENGTH,
  RECOVERY_KEY_CHECK_PAYLOAD_MAX_LENGTH,
  RECOVERY_KEY_CHECK_IV_MAX_LENGTH
} from '../config/constants.js';

const registerSchema = Joi.object({
  email: Joi.string().trim().email().max(EMAIL_MAX_LENGTH).required().messages({
    'string.empty': 'email requis',
    'string.max': 'email trop long',
    'string.email': 'format email invalide'
  }),
  password: Joi.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).required().messages({
    'string.empty': 'password requis',
    'string.min': `mot de passe minimum ${PASSWORD_MIN_LENGTH} caractères`,
    'string.max': 'mot de passe trop long'
  }),
  nom: Joi.string().trim().max(NOM_MAX_LENGTH).required().messages({
    'string.empty': 'nom requis',
    'string.max': 'nom trop long'
  }),
  prenom: Joi.string().trim().max(PRENOM_MAX_LENGTH).required().messages({
    'string.empty': 'prenom requis',
    'string.max': 'prenom trop long'
  }),
  adresse: Joi.string().trim().max(ADRESSE_MAX_LENGTH).allow('', null).default(null).messages({
    'string.max': 'adresse trop longue'
  })
}).options({ stripUnknown: true });

const loginSchema = Joi.object({
  email: Joi.string().trim().email().max(EMAIL_MAX_LENGTH).required().messages({
    'string.empty': 'email requis',
    'string.max': 'email trop long',
    'string.email': 'format email invalide'
  }),
  password: Joi.string().max(PASSWORD_MAX_LENGTH).required().messages({
    'string.empty': 'password requis',
    'string.max': 'mot de passe trop long'
  })
}).options({ stripUnknown: true });

export function validateRegister(body) {
  const result = registerSchema.validate(body, { abortEarly: false });
  if (result.error) {
    const message = result.error.details.map((d) => d.message).join('. ');
    return { value: null, error: message };
  }
  const v = result.value;
  return {
    value: {
      email: v.email,
      password: v.password,
      nom: v.nom,
      prenom: v.prenom,
      adresse: v.adresse && v.adresse.length > 0 ? v.adresse : null
    },
    error: null
  };
}

export function validateLogin(body) {
  const result = loginSchema.validate(body, { abortEarly: false });
  if (result.error) {
    const message = result.error.details.map((d) => d.message).join('. ');
    return { value: null, error: message };
  }
  return { value: result.value, error: null };
}

const recoveryDataSchema = Joi.object({
  salt: Joi.string().max(RECOVERY_SALT_MAX_LENGTH).required().messages({
    'string.empty': 'salt requis',
    'string.max': 'salt trop long'
  }),
  keyCheck: Joi.object({
    payload: Joi.string().max(RECOVERY_KEY_CHECK_PAYLOAD_MAX_LENGTH).required(),
    iv: Joi.string().max(RECOVERY_KEY_CHECK_IV_MAX_LENGTH).required()
  }).required().messages({
    'object.base': 'keyCheck invalide'
  })
}).options({ stripUnknown: true });

const resetPasswordSchema = Joi.object({
  email: Joi.string().trim().email().max(EMAIL_MAX_LENGTH).required().messages({
    'string.empty': 'email requis',
    'string.email': 'format email invalide'
  }),
  newPassword: Joi.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).required().messages({
    'string.empty': 'nouveau mot de passe requis',
    'string.min': `mot de passe minimum ${PASSWORD_MIN_LENGTH} caractères`,
    'string.max': 'mot de passe trop long'
  })
}).options({ stripUnknown: true });

export function validateRecoveryData(body) {
  const result = recoveryDataSchema.validate(body, { abortEarly: false });
  if (result.error) {
    const message = result.error.details.map((d) => d.message).join('. ');
    return { value: null, error: message };
  }
  return { value: result.value, error: null };
}

export function validateResetPassword(body) {
  const result = resetPasswordSchema.validate(body, { abortEarly: false });
  if (result.error) {
    const message = result.error.details.map((d) => d.message).join('. ');
    return { value: null, error: message };
  }
  return { value: result.value, error: null };
}

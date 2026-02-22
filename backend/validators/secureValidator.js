import Joi from 'joi';
import {
  INVOICE_ID_MAX,
  DOCUMENT_ID_MAX,
  FILENAME_MAX,
  MIMETYPE_MAX,
  HASH_HEX_LENGTH,
  SIGNATURE_MAX,
  VERIFY_BATCH_MAX
} from '../config/constants.js';

const hashHexSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(new RegExp(`^[a-f0-9]{${HASH_HEX_LENGTH}}$`))
  .required();

const proofSchema = Joi.object({
  invoiceId: Joi.string().trim().max(INVOICE_ID_MAX).required().messages({
    'string.empty': 'invoiceId requis',
    'string.max': 'invoiceId trop long'
  }),
  invoiceHash: hashHexSchema.messages({
    'string.empty': 'invoiceHash requis',
    'string.pattern.base': 'invoiceHash doit être un SHA-256 en hex (64 caractères)'
  }),
  signature: Joi.string().trim().max(SIGNATURE_MAX).required().messages({
    'string.empty': 'signature requise',
    'string.max': 'signature trop longue'
  })
}).options({ stripUnknown: true });

const proofVerifyItemSchema = Joi.object({
  invoiceId: Joi.string().trim().max(INVOICE_ID_MAX).required(),
  invoiceHash: hashHexSchema
}).options({ stripUnknown: true });

const proofsVerifySchema = Joi.object({
  checks: Joi.array().items(proofVerifyItemSchema).min(1).max(VERIFY_BATCH_MAX).required().messages({
    'array.min': 'checks requis (tableau non vide)',
    'array.max': `Maximum ${VERIFY_BATCH_MAX} vérifications par requête`
  })
}).options({ stripUnknown: true });

const documentProofSchema = Joi.object({
  documentId: Joi.string().trim().max(DOCUMENT_ID_MAX).required().messages({
    'string.empty': 'documentId requis',
    'string.max': 'documentId trop long'
  }),
  fileHash: hashHexSchema.messages({
    'string.empty': 'fileHash requis',
    'string.pattern.base': 'fileHash doit être un SHA-256 hex (64 caractères)'
  }),
  filename: Joi.string().trim().max(FILENAME_MAX).required().messages({
    'string.empty': 'filename requis',
    'string.max': 'filename trop long'
  }),
  mimeType: Joi.string().trim().max(MIMETYPE_MAX).required().messages({
    'string.empty': 'mimeType requis',
    'string.max': 'mimeType trop long'
  }),
  size: Joi.number().integer().min(0).required().messages({
    'number.base': 'size requis (entier ≥ 0)',
    'number.min': 'size requis (entier ≥ 0)'
  }),
  invoiceId: Joi.string().trim().max(INVOICE_ID_MAX).allow(null, '').default(null).messages({
    'string.max': 'invoiceId optionnel mais invalide'
  })
}).options({ stripUnknown: true });

const documentIdParamSchema = Joi.string().trim().max(DOCUMENT_ID_MAX).required().messages({
  'string.empty': 'documentId invalide',
  'string.max': 'documentId invalide'
});

const invoiceIdParamSchema = Joi.string().trim().max(INVOICE_ID_MAX).required().messages({
  'string.empty': 'invoiceId invalide',
  'string.max': 'invoiceId invalide'
});

const cleanupSchema = Joi.object({
  keepDocumentIds: Joi.array().items(Joi.string().trim().max(DOCUMENT_ID_MAX)).required().messages({
    'array.base': 'keepDocumentIds requis (tableau)'
  })
}).options({ stripUnknown: true });

function toError(result) {
  if (!result.error) return null;
  return result.error.details.map((d) => d.message).join('. ');
}

/**
 * POST /api/proofs
 */
export function validateProofBody(body) {
  const result = proofSchema.validate(body, { abortEarly: false });
  const err = toError(result);
  if (err) return { value: null, error: err };
  const v = result.value;
  return {
    value: {
      invoiceId: v.invoiceId,
      invoiceHash: v.invoiceHash,
      signature: v.signature
    },
    error: null
  };
}

/**
 * POST /api/proofs/verify
 */
export function validateProofsVerifyBody(body) {
  const result = proofsVerifySchema.validate(body, { abortEarly: false });
  const err = toError(result);
  if (err) return { value: null, error: err };
  return { value: result.value, error: null };
}

/**
 * POST /api/documents/proof
 */
export function validateDocumentProofBody(body) {
  const result = documentProofSchema.validate(body, { abortEarly: false });
  const err = toError(result);
  if (err) return { value: null, error: err };
  const v = result.value;
  return {
    value: {
      documentId: v.documentId,
      fileHash: v.fileHash,
      filename: v.filename,
      mimeType: v.mimeType,
      size: v.size,
      invoiceId: v.invoiceId && v.invoiceId.length > 0 ? v.invoiceId : null
    },
    error: null
  };
}

/**
 * DELETE /api/documents/proof/:documentId — param
 */
export function validateDocumentIdParam(documentId) {
  const result = documentIdParamSchema.validate(documentId);
  const err = toError(result);
  if (err) return { value: null, error: err };
  return { value: result.value.trim(), error: null };
}

/**
 * DELETE /api/proofs/:invoiceId — param
 */
export function validateInvoiceIdParam(invoiceId) {
  const result = invoiceIdParamSchema.validate(invoiceId);
  const err = toError(result);
  if (err) return { value: null, error: err };
  return { value: result.value.trim(), error: null };
}

/**
 * POST /api/documents/proofs/cleanup
 */
export function validateCleanupBody(body) {
  const result = cleanupSchema.validate(body || {}, { abortEarly: false });
  const err = toError(result);
  if (err) return { value: null, error: err };
  return { value: result.value, error: null };
}

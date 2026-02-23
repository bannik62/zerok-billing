/**
 * Module mail réutilisable : transport configuré + envoi générique.
 * Aucune logique métier (vérification, devis, signature, prospection).
 * Nécessite GMAIL_USER et GMAIL_APP_PASSWORD dans .env (voir docs/VERIFICATION_EMAIL_GMAIL.md).
 *
 * Utilisation : sendMail({ to, subject, text, html }) pour tout type d’email
 * (vérification compte, lien signature devis/facture, prospection, etc.).
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { log } from '../lib/logger.js';

let transporter = null;

function getTransport() {
  if (transporter) return transporter;
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    log('[zerok-billing] GMAIL_USER ou GMAIL_APP_PASSWORD manquant : envoi d’email désactivé');
    return null;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD
    }
  });
  return transporter;
}

/**
 * Envoie un email (transport Gmail configuré).
 * @param {{ to: string, subject: string, text: string, html?: string, from?: string, replyTo?: string }} options
 * @returns {Promise<void>} lance une erreur si envoi échoue ; ne fait rien si transport indisponible
 */
export async function sendMail({ to, subject, text, html, from, replyTo }) {
  const transport = getTransport();
  if (!transport) return;
  const payload = {
    from: from ?? env.GMAIL_USER,
    to,
    subject,
    text,
    ...(html && { html }),
    ...(replyTo && { replyTo })
  };
  await transport.sendMail(payload);
  log('[zerok-billing] Email envoyé à', to, '|', subject);
}

/**
 * Vues HTML pour la page de confirmation de signature (/sign/confirm).
 */

import { esc } from './utils.js';

export function renderSignConfirmError({ siteUrl }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lien invalide</title>
</head>
<body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;">
  <h1>Lien invalide ou expiré</h1>
  <p>Ce lien a déjà été utilisé ou a expiré.</p>
  <p style="margin-top: 2rem;">
    <a href="${esc(siteUrl)}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a>
  </p>
</body>
</html>`;
}

/**
 * Construit la section paiement (boutons + script) si paymentToken et providers fournis.
 */
export function buildPaymentSection({ paymentToken, providers }) {
  if (!paymentToken || !providers?.length) return '';

  const paymentTokenEscaped = String(paymentToken)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '&quot;');

  const stripeButton = providers.includes('stripe')
    ? `<button type="button" class="pay-btn" data-provider="stripe" data-payment-token="${paymentTokenEscaped}" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; font-size: 0.95rem;">
  <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo,_revised_2016.svg" alt="Stripe" width="80" height="32" style="vertical-align: middle;">
  <span>Payer avec Stripe</span>
</button>`
    : '';

  return `
<section class="pay-section" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">
  <p style="margin: 0 0 1rem; font-weight: 600;">Régler cette facture</p>
  <div class="pay-icons" style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; align-items: center;">
    ${stripeButton}
  </div>
  <p id="pay-msg" style="margin: 0.75rem 0 0; font-size: 0.875rem; color: #6b7280; min-height: 1.25rem;"></p>
</section>
<script>
(function() {
  var buttons = document.querySelectorAll('.pay-btn');
  var msg = document.getElementById('pay-msg');
  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var provider = btn.getAttribute('data-provider');
      var paymentToken = btn.getAttribute('data-payment-token');
      if (!paymentToken || !provider) return;
      msg.textContent = 'Redirection…';
      btn.disabled = true;
      fetch('/api/payment/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentToken: paymentToken, provider: provider })
      }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
        .then(function(x) {
          if (x.data.redirectUrl) { window.location.href = x.data.redirectUrl; return; }
          msg.textContent = x.data.error || 'Erreur';
          btn.disabled = false;
        })
        .catch(function() { msg.textContent = 'Erreur de connexion'; btn.disabled = false; });
    });
  });
})();
</script>`;
}

export function renderSignConfirmOk({ paymentSection, siteUrl }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Document accepté</title>
</head>
<body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;">
  <h1>Document accepté</h1>
  <p>Votre signature a bien été enregistrée.</p>
  ${paymentSection}
  <p style="margin-top: 2rem;">
    <a href="${esc(siteUrl)}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a>
  </p>
</body>
</html>`;
}

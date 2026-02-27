<script>
  /**
   * Témoin clé de chiffrement : affiche "Clé chargée" (vert) ou "Non chargée" (rouge).
   * La clé est dérivée du mot de passe au Login (frontend uniquement, jamais envoyée au serveur).
   * Elle sert à chiffrer/déchiffrer devis et factures dans IndexedDB (AES-GCM).
   */
  import { encryptionKeyLoadedStore } from '$lib/dbEncrypted.js';
</script>

<div class="cle-temoin" aria-live="polite" aria-label="État de la clé de chiffrement">
  {#if $encryptionKeyLoadedStore}
    <span class="cle-temoin-label cle-temoin-ok">Clé chargée</span>
  {:else}
    <span class="cle-temoin-label cle-temoin-err">Clé non chargée</span>
  {/if}
</div>

<style>
  .cle-temoin {
    width: 100%;
    min-height: 2.5rem;
    padding: 0.5rem 0.6rem;
    border-radius: 8px;
    font-size: clamp(0.78rem, 2vw, 0.9rem);
    font-family: system-ui, sans-serif;
    background: var(--color-bg-elevated);
    color: var(--color-text-soft);
    border: 1px solid var(--color-border);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  @media (max-width: 380px) {
    .cle-temoin { min-height: 2.25rem; font-size: 0.75rem; padding: 0.45rem 0.5rem; }
  }
  .cle-temoin-label { font-weight: 500; }
  .cle-temoin-ok { color: var(--color-primary); }
  .cle-temoin-err { color: var(--color-error); }
</style>

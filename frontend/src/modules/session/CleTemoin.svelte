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
    <span class="cle-temoin-label cle-temoin-err">Non chargée</span>
  {/if}
</div>

<style>
  .cle-temoin {
    position: fixed;
    bottom: 2.75rem;
    right: 0.75rem;
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-family: system-ui, sans-serif;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    z-index: 9999;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  .cle-temoin-label { font-weight: 500; }
  .cle-temoin-ok { color: #15803d; }
  .cle-temoin-err { color: #b91c1c; }
</style>

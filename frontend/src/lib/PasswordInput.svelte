<script>
  import { createPasswordField } from '$lib/formField.js';

  let {
    field = null,
    id = '',
    placeholder = 'Mot de passe',
    disabled = false,
    autocomplete = 'current-password'
  } = $props();

  const internalField = field ?? createPasswordField('', { autocomplete });
  const store = internalField.store;

  let showPassword = $state(false);
</script>

<div class="password-wrap">
  <input
    id={id}
    type={showPassword ? 'text' : 'password'}
    placeholder={placeholder}
    required
    disabled={disabled}
    minlength={internalField.minLength}
    maxlength={internalField.maxLength}
    autocomplete={internalField.autocomplete ?? undefined}
    value={$store}
    oninput={(e) => (internalField.value = e.currentTarget.value)}
  />
  <button
    type="button"
    class="toggle-pwd"
    onclick={() => (showPassword = !showPassword)}
    disabled={disabled}
    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
  >
    {#if showPassword}
      <svg class="icon-eye" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    {:else}
      <svg class="icon-eye" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    {/if}
  </button>
</div>

<style>
  .password-wrap {
    position: relative;
  }
  .password-wrap input {
    width: 100%;
    box-sizing: border-box;
    padding-right: 2.5rem;
  }
  .password-wrap .toggle-pwd {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 2.5rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 0 4px 4px 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .password-wrap .toggle-pwd:hover:not(:disabled) {
    color: var(--color-text);
    background: var(--color-bg-muted);
  }
  .password-wrap .toggle-pwd:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .password-wrap .icon-eye {
    flex-shrink: 0;
  }
</style>


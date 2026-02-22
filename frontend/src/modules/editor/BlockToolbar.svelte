<script>
  import { FONT_SIZES, FONT_FAMILIES } from './utils.js';

  let {
    pos,
    onUpdateStyle = () => {},
    onClose = () => {}
  } = $props();
</script>

<div
  class="block-toolbar"
  style="left: {pos.left}%; top: {Math.max(0, pos.top - 10)}%;"
  role="toolbar"
  aria-label="Style du bloc"
  tabindex="0"
  onmousedown={(e) => e.stopPropagation()}
>
  <span class="block-toolbar-label">Style</span>
  <label class="block-toolbar-field">
    <span>Taille</span>
    <select
      value={pos.fontSize ?? 12}
      onchange={(e) => onUpdateStyle('fontSize', Number(e.currentTarget.value))}
    >
      {#each FONT_SIZES as sz}
        <option value={sz}>{sz}px</option>
      {/each}
    </select>
  </label>
  <label class="block-toolbar-field">
    <span>Police</span>
    <select
      value={pos.fontFamily ?? ''}
      onchange={(e) => onUpdateStyle('fontFamily', e.currentTarget.value)}
    >
      {#each FONT_FAMILIES as f}
        <option value={f.value}>{f.label}</option>
      {/each}
    </select>
  </label>
  <label class="block-toolbar-field block-toolbar-color">
    <span>Couleur</span>
    <input
      type="color"
      value={pos.color ?? '#0f172a'}
      oninput={(e) => onUpdateStyle('color', e.currentTarget.value)}
    />
  </label>
  <button
    type="button"
    class="block-toolbar-btn block-toolbar-bold-btn"
    class:active={pos.fontWeight === 'bold'}
    onclick={() => onUpdateStyle('fontWeight', pos.fontWeight === 'bold' ? 'normal' : 'bold')}
    aria-label="Gras"
    title="Gras"
  >B</button>
  <div class="block-toolbar-field block-toolbar-align" role="group" aria-label="Alignement">
    <span class="block-toolbar-align-label">Aligner</span>
    <button
      type="button"
      class="block-toolbar-align-btn"
      class:active={(pos.textAlign ?? 'left') === 'left'}
      onclick={() => onUpdateStyle('textAlign', 'left')}
      aria-label="Gauche"
      title="Gauche"
    >⊣</button>
    <button
      type="button"
      class="block-toolbar-align-btn"
      class:active={(pos.textAlign ?? 'left') === 'center'}
      onclick={() => onUpdateStyle('textAlign', 'center')}
      aria-label="Centre"
      title="Centre"
    >≡</button>
    <button
      type="button"
      class="block-toolbar-align-btn"
      class:active={(pos.textAlign ?? 'left') === 'right'}
      onclick={() => onUpdateStyle('textAlign', 'right')}
      aria-label="Droite"
      title="Droite"
    >⊢</button>
  </div>
  <button type="button" class="block-toolbar-close" onclick={onClose} aria-label="Fermer">×</button>
</div>

<style>
  .block-toolbar {
    position: absolute;
    z-index: 10;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.35rem 0.5rem;
    background: #0f172a;
    color: #fff;
    border-radius: 8px;
    font-size: 0.75rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .block-toolbar-label {
    font-weight: 600;
    margin-right: 0.25rem;
  }
  .block-toolbar-field {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .block-toolbar-field span {
    color: #94a3b8;
  }
  .block-toolbar select {
    padding: 0.2rem 0.35rem;
    border-radius: 4px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #fff;
    font-size: 0.75rem;
  }
  .block-toolbar-align {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
  }
  .block-toolbar-align-label {
    color: #94a3b8;
    margin-right: 0.1rem;
  }
  .block-toolbar-align-btn {
    padding: 0.2rem 0.4rem;
    border: 1px solid #475569;
    background: #1e293b;
    color: #94a3b8;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .block-toolbar-align-btn:hover {
    color: #fff;
    border-color: #64748b;
  }
  .block-toolbar-align-btn.active {
    background: #0f766e;
    color: #fff;
    border-color: #0f766e;
  }
  .block-toolbar-btn {
    padding: 0.2rem 0.4rem;
    border: 1px solid #475569;
    background: #1e293b;
    color: #94a3b8;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .block-toolbar-btn:hover {
    color: #fff;
    border-color: #64748b;
  }
  .block-toolbar-btn.active {
    background: #0f766e;
    color: #fff;
    border-color: #0f766e;
  }
  .block-toolbar-bold-btn {
    font-weight: 700;
  }
  .block-toolbar-color input[type="color"] {
    width: 24px;
    height: 22px;
    padding: 0;
    border: 1px solid #475569;
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
  }
  .block-toolbar-close {
    margin-left: 0.25rem;
    padding: 0 0.35rem;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
  }
  .block-toolbar-close:hover {
    color: #fff;
  }
</style>

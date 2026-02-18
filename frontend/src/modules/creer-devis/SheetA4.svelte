<script>
  import { normalisePos } from './utils.js';
  import PlacedBlock from './PlacedBlock.svelte';
  import BlockToolbar from './BlockToolbar.svelte';

  let {
    sheetEl = $bindable(null),
    blockPositions = {},
    selectedBlock = null,
    document = null,
    documentType = 'devis',
    resolvedClient = null,
    resolvedSociete = null,
    onDrop = () => {},
    onOver = () => {},
    onCanvasMouseDown = () => {},
    onMouseMove = () => {},
    onMouseUp = () => {},
    onPlacedBlockMouseDown = () => {},
    onResizeMouseDown = () => {},
    onUpdateBlockStyle = () => {},
    onCloseToolbar = () => {}
  } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
<div
  bind:this={sheetEl}
  class="sheet-a4"
  class:sheet-a4-facture={documentType === 'facture'}
  role="application"
  aria-label="Feuille A4 – déposez les blocs ici"
  ondragover={onOver}
  ondrop={onDrop}
  onmousedown={onCanvasMouseDown}
  onmousemove={onMouseMove}
  onmouseup={onMouseUp}
  onmouseleave={onMouseUp}
>
  {#each Object.entries(blockPositions) as [type, pos]}
    {@const p = normalisePos(pos)}
    {#if p}
      <PlacedBlock
        {type}
        pos={p}
        selected={selectedBlock === type}
        {document}
        {documentType}
        {resolvedClient}
        {resolvedSociete}
        onMouseDown={onPlacedBlockMouseDown}
        onResizeMouseDown={onResizeMouseDown}
      />
    {/if}
  {/each}

  {#if selectedBlock}
    {@const pos = normalisePos(blockPositions[selectedBlock])}
    {#if pos}
      <BlockToolbar
        pos={pos}
        onUpdateStyle={(key, value) => onUpdateBlockStyle(selectedBlock, key, value)}
        onClose={onCloseToolbar}
      />
    {/if}
  {/if}
</div>

<style>
  .sheet-a4 {
    position: relative;
    width: 100%;
    max-width: 595px;
    aspect-ratio: 210 / 297;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 2px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    min-height: 300px;
  }
  .sheet-a4-facture {
    border-color: #7dd3fc;
    box-shadow: 0 4px 6px -1px rgba(3, 105, 161, 0.15);
  }

  @media print {
    .sheet-a4 {
      border: none !important;
      box-shadow: none !important;
    }
  }
</style>

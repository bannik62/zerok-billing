/**
 * Export coffre-fort : génération d’un ZIP des pièces jointes liées à un devis/facture.
 * Responsabilité unique : construire le Blob ZIP à partir des documents déchiffrés.
 */

import JSZip from 'jszip';

/**
 * Génère une archive ZIP contenant les fichiers des documents (déjà récupérés et déchiffrés).
 * @param {{ id: string, filename: string, blob: Blob }[]} decryptedFiles - liste { id, filename, blob }
 * @param {string} zipBaseName - nom de base du ZIP (ex. "Devis-2026-001-pieces-jointes")
 * @returns {Promise<Blob>}
 */
export async function buildAttachmentsZip(decryptedFiles, zipBaseName) {
  const zip = new JSZip();
  const usedNames = new Set();
  for (const { filename, blob } of decryptedFiles) {
    let name = filename || 'document';
    if (usedNames.has(name)) {
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
      const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
      let n = 1;
      while (usedNames.has(base + '_' + n + ext)) n++;
      name = base + '_' + n + ext;
    }
    usedNames.add(name);
    zip.file(name, blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Télécharge un Blob sous un nom de fichier.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

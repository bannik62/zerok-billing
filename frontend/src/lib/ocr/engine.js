/**
 * Moteur OCR : image → texte.
 * Responsabilité unique : Tesseract.js, langue fra+eng pour factures FR.
 * Aucune logique métier (parsing) ici.
 */

import { createWorker } from 'tesseract.js';

const LANG = 'fra+eng';
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(LANG);
  }
  return workerPromise;
}

/**
 * Reconnaît le texte d'une source image (File, Blob, URL, canvas).
 * @param {File|Blob|string|HTMLImageElement|HTMLCanvasElement} source
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function recognize(source) {
  const worker = await getWorker();
  const { data } = await worker.recognize(source);
  return {
    text: (data?.text ?? '').trim(),
    confidence: typeof data?.confidence === 'number' ? data.confidence : 0
  };
}

/** Libère le worker (à appeler si on veut libérer la mémoire, ex. changement de page). */
export async function terminate() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}

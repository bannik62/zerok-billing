/**
 * PDF → images pour OCR.
 * Responsabilité unique : extraire la première page d'un PDF en canvas (ImageData-compatible).
 * Utilise pdfjs-dist, worker chargé côté client.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SCALE = 2;

/**
 * Récupère le premier canvas rendu de la page demandée du PDF.
 * @param {File} file - Fichier PDF
 * @param {number} pageNum - Numéro de page (1-based), défaut 1
 * @returns {Promise<HTMLCanvasElement|null>} Canvas ou null si erreur
 */
export async function pdfPageToCanvas(file, pageNum = 1) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;
  return canvas;
}

/**
 * Nombre de pages du PDF (pour affichage ou boucle).
 * @param {File} file
 * @returns {Promise<number>}
 */
export async function getPdfPageCount(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  return pdf.numPages;
}

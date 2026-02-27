/**
 * Lib comptabilité – calculs purs (aucune dépendance Svelte).
 *
 * Entrée typique :
 * - factures : array d'objets issus de IndexedDB (via dbEncrypted.getAllFactures)
 * - achats   : array d'objets issus de IndexedDB (via dbEncrypted.getAllAchats)
 *
 * Tous les montants sont en nombre (euros) avec 2 décimales max.
 */

function toNumber(value, def = 0) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || Number.isNaN(n)) return def;
  return n;
}

function parseIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isWithinPeriod(date, from, to) {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function ymKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function pickFactureAmounts(facture) {
  const totalTTC =
    toNumber(
      facture?.totalTTC ??
      facture?.total ??
      facture?.sousTotal,
      0
    );
  const tvaMontant = toNumber(facture?.tvaMontant, 0);
  const totalHT = totalTTC - tvaMontant;
  const result = {
    totalTTC: Math.round(totalTTC * 100) / 100,
    totalHT: Math.round(totalHT * 100) / 100,
    tva: Math.round(tvaMontant * 100) / 100
  };
  if (![result.totalTTC, result.totalHT, result.tva].every(Number.isFinite)) {
    return { totalTTC: 0, totalHT: 0, tva: 0 };
  }
  return result;
}

function pickAchatAmounts(achat) {
  const ht = toNumber(achat?.montantHT, 0);
  const ttc = toNumber(achat?.montantTTC, ht);
  let tva;
  if (achat && typeof achat.tva === 'number') {
    tva = Math.round(ht * (achat.tva / 100) * 100) / 100;
  } else {
    tva = ttc - ht;
  }
  const result = {
    totalTTC: Math.round(ttc * 100) / 100,
    totalHT: Math.round(ht * 100) / 100,
    tva: Math.round(tva * 100) / 100
  };
  if (![result.totalTTC, result.totalHT, result.tva].every(Number.isFinite)) {
    return { totalTTC: 0, totalHT: 0, tva: 0 };
  }
  return result;
}

/**
 * Construit un "snapshot" comptable sur une période donnée.
 *
 * @param {{ factures: any[], achats: any[] }} data
 * @param {{ from?: Date | null, to?: Date | null }} [periode]
 */
export function buildComptaSnapshot(data, periode = {}) {
  const factures = Array.isArray(data?.factures) ? data.factures : [];
  const achats = Array.isArray(data?.achats) ? data.achats : [];
  const from = periode.from ?? null;
  const to = periode.to ?? null;

  let caTTC = 0;
  let caHT = 0;
  let tvaCollectee = 0;

  let achatsTTC = 0;
  let achatsHT = 0;
  let tvaDeductible = 0;

  /** @type {Record<string, { caTTC: number, achatsTTC: number }>} */
  const parMois = {};
  /** @type {Record<string, number>} */
  const parCategorieAchats = {};

  for (const f of factures) {
    const d = parseIsoDate(f?.entete?.dateEmission || f?.date || f?.createdAt);
    if (!isWithinPeriod(d, from, to)) continue;
    const { totalTTC, totalHT, tva } = pickFactureAmounts(f);
    caTTC += totalTTC;
    caHT += totalHT;
    tvaCollectee += tva;
    if (d) {
      const key = ymKey(d);
      if (!parMois[key]) parMois[key] = { caTTC: 0, achatsTTC: 0 };
      parMois[key].caTTC += totalTTC;
    }
  }

  for (const a of achats) {
    const d = parseIsoDate(a?.date || a?.createdAt);
    if (!isWithinPeriod(d, from, to)) continue;
    const { totalTTC, totalHT, tva } = pickAchatAmounts(a);
    achatsTTC += totalTTC;
    achatsHT += totalHT;
    tvaDeductible += tva;

    if (d) {
      const key = ymKey(d);
      if (!parMois[key]) parMois[key] = { caTTC: 0, achatsTTC: 0 };
      parMois[key].achatsTTC += totalTTC;
    }

    const cat = (a?.categorie || 'Autre').trim() || 'Autre';
    parCategorieAchats[cat] = (parCategorieAchats[cat] || 0) + totalTTC;
  }

  const resultatNet = caHT - achatsHT;

  const parMoisArr = Object.entries(parMois)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([yearMonth, v]) => ({
      yearMonth,
      caTTC: Math.round(v.caTTC * 100) / 100,
      achatsTTC: Math.round(v.achatsTTC * 100) / 100
    }));

  const parCategorieAchatsArr = Object.entries(parCategorieAchats)
    .sort(([, va], [, vb]) => vb - va)
    .map(([categorie, totalTTC]) => ({
      categorie,
      totalTTC: Math.round(totalTTC * 100) / 100
    }));

  return {
    from,
    to,
    caTTC: Math.round(caTTC * 100) / 100,
    caHT: Math.round(caHT * 100) / 100,
    tvaCollectee: Math.round(tvaCollectee * 100) / 100,
    achatsTTC: Math.round(achatsTTC * 100) / 100,
    achatsHT: Math.round(achatsHT * 100) / 100,
    tvaDeductible: Math.round(tvaDeductible * 100) / 100,
    resultatNet: Math.round(resultatNet * 100) / 100,
    parMois: parMoisArr,
    parCategorieAchats: parCategorieAchatsArr
  };
}


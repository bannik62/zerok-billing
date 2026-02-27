/**
 * Templates OCR light inspires de invoice2data.
 */

export const OCR_TEMPLATES = [
  {
    id: 'ovh-fr',
    issuer: 'OVHcloud',
    keywords: [/ovh|ovhcloud/i, /facture|invoice|reference/i],
    fields: {
      date: [
        /(?:date\s+de\s+facture|invoice\s+date|date)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i
      ],
      invoiceNumber: [
        /(?:n[°o]\s*facture|invoice\s*(?:number|no)|reference)\s*[:\-]?\s*([A-Z0-9\-./]{4,})/i
      ],
      amountHT: [
        /(?:total\s*ht|subtotal|sous-total|hors\s+taxe?s?)\s*[:\-]?\s*([0-9][\d\s]*(?:[.,]\d{2})?)/i
      ],
      amountTTC: [
        /(?:total\s*ttc|amount\s*due|net\s+a\s+payer|montant\s+a\s+regler|total)\s*[:\-]?\s*([0-9][\d\s]*(?:[.,]\d{2})?)/i
      ],
      tva: [
        /(?:tva|vat)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*%/i,
        /(?:tax)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*%/i
      ],
      supplier: [/ovhcloud|^ovh\b/i]
    }
  },
  {
    id: 'edf-fr',
    issuer: 'EDF',
    keywords: [/edf|electricite de france/i, /facture|echeancier|client/i],
    fields: {
      date: [
        /(?:date\s+de\s+facture|date\s+d[' ]emission|emise\s+le)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i,
        /(?:periode\s+de\s+facturation|du\s+\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}\s+au)\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i
      ],
      invoiceNumber: [
        /(?:n[°o]\s*facture|facture\s+n[°o]|reference\s+facture|ref(?:erence)?\s+facture)\s*[:\-]?\s*([A-Z0-9\-./]{4,})/i
      ],
      amountHT: [
        /(?:total\s*ht|montant\s*ht|hors\s+taxes?)\s*[:\-]?\s*([0-9][\d\s]*(?:[.,]\d{2})?)/i
      ],
      amountTTC: [
        /(?:net\s+a\s+payer|montant\s+a\s+regler|total\s*ttc|montant\s*ttc|total\s*facture)\s*[:\-]?\s*([0-9][\d\s]*(?:[.,]\d{2})?)/i
      ],
      tva: [
        /(?:tva)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*%/i,
        /(?:taux)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*%/i
      ],
      supplier: [/electricite\s+de\s+france|^edf\b/i]
    }
  },
  {
    id: 'generic-fr-facture',
    issuer: 'Generic FR',
    keywords: [/facture/i, /(total|montant|ttc|ht)/i],
    fields: {
      date: [
        /(?:date|date d[' ]emission|date facture)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i
      ],
      invoiceNumber: [
        /(?:facture|invoice|n°|no|numero)\s*(?:n°|no|num(?:ero)?)?\s*[:\-]?\s*([A-Z0-9\-./]{3,})/i
      ],
      amountHT: [
        /(?:total\s*ht|montant\s*ht|hors\s+taxe?s?)[^\d]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)/i
      ],
      amountTTC: [
        /(?:total\s*ttc|montant\s*ttc|grand\s*total|total\s*facture)[^\d]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)/i
      ],
      tva: [/(?:tva)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*%/i],
      supplier: [/(?:fournisseur|vendeur|seller|issuer)\s*[:\-]?\s*([^\n]{3,80})/i]
    }
  },
  {
    id: 'aws-fr-en',
    issuer: 'Amazon Web Services',
    keywords: [/amazon web services|aws/i, /invoice|facture/i],
    fields: {
      date: [
        /(?:invoice date|date facture)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i
      ],
      invoiceNumber: [/(?:invoice number|numero de facture)\s*[:\-]?\s*([A-Z0-9\-./]{4,})/i],
      amountHT: [/(?:total excluding vat|subtotal|sous-total)[^\d]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)/i],
      amountTTC: [/(?:amount due|total due|total ttc)[^\d]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)/i],
      tva: [/(?:vat|tva)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*%/i],
      supplier: [/amazon web services/i]
    }
  }
];

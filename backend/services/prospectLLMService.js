/**
 * Service Prospect : orchestration LLM (OpenAI / Mistral) + outils SIRENE, cadastre, Pappers.
 * Retourne la réponse texte et une liste structurée de résultats typés pour le panel côté frontend.
 */

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'searchSIRENE',
      description:
        'Recherche des entreprises françaises par activité et localisation. Utiliser pour toute question sur des entreprises, commerces, artisans.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Termes de recherche (activité, nom...)' },
          departement: { type: 'string', description: 'Code département (ex: 62 pour Pas-de-Calais)' },
          code_postal: { type: 'string', description: 'Code postal exact (ex: 62100)' },
          per_page: { type: 'number', description: 'Nombre de résultats (défaut: 10, max: 25)' }
        },
        required: ['q']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCommune',
      description:
        'Résout un nom de commune en code département et code postal. À appeler avant searchSIRENE si la ville est mentionnée.',
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: 'Nom de la commune (ex: Calais, Lyon, Paris)' }
        },
        required: ['nom']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPappers',
      description:
        "Enrichit une entreprise avec ses bilans et dirigeants. Nécessite clé Pappers configurée.",
      parameters: {
        type: 'object',
        properties: {
          siret: { type: 'string', description: "SIRET de l'entreprise (14 chiffres)" }
        },
        required: ['siret']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchCadastre',
      description:
        'Recherche des parcelles cadastrales à partir d’une adresse ou de coordonnées (lon/lat). Utiliser pour toute question sur le cadastre ou les parcelles.',
      parameters: {
        type: 'object',
        properties: {
          adresse: {
            type: 'string',
            description: 'Adresse textuelle (ex: "12 rue X, 62100 Calais"). Optionnelle si lon/lat fournis.'
          },
          lon: {
            type: 'number',
            description: 'Longitude WGS84. Optionnelle si une adresse est fournie.'
          },
          lat: {
            type: 'number',
            description: 'Latitude WGS84. Optionnelle si une adresse est fournie.'
          }
        },
        required: []
      }
    }
  }
];

/**
 * Normalise un résultat SIRENE en objet typé.
 * @param {object} hit - Entrée brute API
 * @returns {object|null}
 */
function normalizeSireneHit(hit) {
  if (!hit || typeof hit !== 'object') return null;
  const siret = hit.siret ?? hit.siren ?? '';
  const nom = hit.nom_complet ?? hit.denomination ?? hit.nom ?? hit.unite_legale?.denomination ?? '';
  const adresse = hit.adresse ?? hit.siege?.adresse ?? [hit.voie, hit.code_postal, hit.libelle_commune].filter(Boolean).join(', ') ?? '';
  const formeJuridique = hit.forme_juridique ?? hit.unite_legale?.forme_juridique ?? '';
  if (!siret && !nom) return null;
  return {
    type: 'sirene',
    siret: String(siret),
    siren: hit.siren ? String(hit.siren) : undefined,
    nom: String(nom),
    adresse: String(adresse || ''),
    formeJuridique: String(formeJuridique || ''),
    codePostal: hit.code_postal ? String(hit.code_postal) : hit.siege?.code_postal ? String(hit.siege.code_postal) : undefined,
    commune: hit.libelle_commune ?? hit.siege?.libelle_commune ?? undefined,
    codeNaf: hit.activite_principale ?? hit.siege?.activite_principale ?? undefined,
    libelleNaf: hit.libelle_activite_principale ?? hit.siege?.libelle_activite_principale ?? undefined
  };
}

/**
 * Construit un tableau de résultats cadastre typés à partir d'une FeatureCollection GeoJSON.
 * @param {any} geojson
 * @param {object} opts
 * @param {string} [opts.adresseApprox]
 * @returns {Array<object>}
 */
function normalizeCadastreFeatures(geojson, opts = {}) {
  const out = [];
  if (!geojson || typeof geojson !== 'object' || !Array.isArray(geojson.features)) return out;
  const adresseApprox = typeof opts.adresseApprox === 'string' ? opts.adresseApprox : undefined;
  for (const f of geojson.features) {
    const props = f?.properties || {};
    const idParcelle = props.id || props.idu || props.id_parcelle || null;
    const commune = props.commune || props.libelle_commune || props.nom_commune || '';
    const codeCommune = props.code_insee || props.insee || undefined;
    const section = props.section || props.section_parcellaire || '';
    const numeroParcelle = props.numero || props.numero_parcelle || '';
    if (!idParcelle && !numeroParcelle) continue;
    let lon;
    let lat;
    if (f.geometry && f.geometry.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
      lon = f.geometry.coordinates[0];
      lat = f.geometry.coordinates[1];
    } else if (geojson?.bbox && Array.isArray(geojson.bbox) && geojson.bbox.length >= 4) {
      // centre approximatif du bbox
      lon = (geojson.bbox[0] + geojson.bbox[2]) / 2;
      lat = (geojson.bbox[1] + geojson.bbox[3]) / 2;
    }
    const surfaceM2 = typeof props.surface === 'number' ? props.surface : undefined;
    out.push({
      type: 'cadastre',
      idParcelle: String(idParcelle || `${section}-${numeroParcelle}`),
      commune: String(commune || ''),
      codeCommune: codeCommune ? String(codeCommune) : undefined,
      section: String(section || ''),
      numeroParcelle: String(numeroParcelle || ''),
      surfaceM2,
      adresseApprox,
      lon,
      lat,
      geojson: f
    });
  }
  return out;
}

/**
 * Exécute un outil et retourne le résultat (objet ou tableau). En cas d'erreur, retourne { error: string }.
 * Les résultats searchSIRENE / cadastre sont normalisés et ajoutés à resultsCollector.
 * @param {string} name - Nom de l'outil
 * @param {object} args - Arguments (parsés depuis le LLM)
 * @param {string|null} pappersKey - Clé API Pappers
 * @param {Array} resultsCollector - Tableau muté pour y ajouter les entreprises trouvées
 */
async function executeTool(name, args, pappersKey, resultsCollector) {
  try {
    if (name === 'getCommune') {
      const nom = typeof args?.nom === 'string' ? args.nom.trim() : '';
      if (!nom) return { error: 'Paramètre nom requis' };
      const r = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(nom)}&fields=code,codesPostaux,codeDepartement&limit=5`
      );
      if (!r.ok) return { error: `Erreur API communes: ${r.status}` };
      const data = await r.json();
      return Array.isArray(data) ? data : [data].filter(Boolean);
    }

    if (name === 'searchSIRENE') {
      const q = typeof args?.q === 'string' ? args.q.trim() : '';
      if (!q) return { error: 'Paramètre q requis' };
      const per_page = Math.min(25, Math.max(1, Number(args?.per_page) || 10));
      const params = new URLSearchParams({ q, per_page: String(per_page) });
      if (args?.departement) params.set('departement', String(args.departement).trim());
      if (args?.code_postal) params.set('code_postal', String(args.code_postal).trim());
      const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`);
      if (!r.ok) return { error: `Erreur API SIRENE: ${r.status}` };
      const data = await r.json();
      const results = data.results ?? data.etablissements ?? (Array.isArray(data) ? data : []);
      const list = Array.isArray(results) ? results : [];
      for (const hit of list) {
        const normalized = normalizeSireneHit(hit);
        if (normalized) resultsCollector.push(normalized);
      }
      return { results: list, total: data.total ?? list.length };
    }

    if (name === 'getPappers') {
      const siret = typeof args?.siret === 'string' ? args.siret.replace(/\s/g, '') : '';
      if (!siret || siret.length !== 14) return { error: 'SIRET invalide (14 chiffres requis)' };
      if (!pappersKey) return { error: 'Clé Pappers non configurée' };
      const r = await fetch(
        `https://api.pappers.fr/v2/entreprise?siret=${encodeURIComponent(siret)}&api_token=${pappersKey}`
      );
      if (!r.ok) {
        const text = await r.text();
        return { error: `Erreur Pappers: ${r.status}${text ? ` - ${text.slice(0, 200)}` : ''}` };
      }
      const data = await r.json();
      return data;
    }

    if (name === 'searchCadastre') {
      let adresse = typeof args?.adresse === 'string' ? args.adresse.trim() : '';
      let lon = typeof args?.lon === 'number' ? args.lon : undefined;
      let lat = typeof args?.lat === 'number' ? args.lat : undefined;
      let adresseApprox;

      // Étape 1 : si adresse fournie et pas de lon/lat, géocoder via API Adresse
      if ((!lon || !lat) && adresse) {
        const params = new URLSearchParams({ q: adresse, limit: '1' });
        const geoRes = await fetch(`https://api-adresse.data.gouv.fr/search/?${params.toString()}`);
        if (!geoRes.ok) {
          return { error: `Erreur API Adresse: ${geoRes.status}` };
        }
        const geo = await geoRes.json();
        const feat = Array.isArray(geo.features) && geo.features.length > 0 ? geo.features[0] : null;
        if (feat && feat.geometry && Array.isArray(feat.geometry.coordinates)) {
          lon = feat.geometry.coordinates[0];
          lat = feat.geometry.coordinates[1];
          adresseApprox = feat.properties?.label || adresse;
        } else {
          return { error: 'Adresse introuvable pour le cadastre' };
        }
      }

      if (typeof lon !== 'number' || typeof lat !== 'number') {
        return { error: 'Coordonnées (lon, lat) ou adresse requises pour le cadastre' };
      }

      const pointGeom = JSON.stringify({ type: 'Point', coordinates: [lon, lat] });
      const cadParams = new URLSearchParams({ geom: pointGeom });
      const cadRes = await fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?${cadParams.toString()}`);
      if (!cadRes.ok) {
        return { error: `Erreur API Cadastre: ${cadRes.status}` };
      }
      const cadGeo = await cadRes.json();
      const items = normalizeCadastreFeatures(cadGeo, { adresseApprox });
      if (Array.isArray(items) && items.length > 0) {
        resultsCollector.push(...items);
      }
      return { count: items.length };
    }

    return { error: `Outil inconnu: ${name}` };
  } catch (err) {
    return { error: err?.message ?? 'Erreur inconnue' };
  }
}

/**
 * Lance un cycle de chat Prospect : LLM + tool calls, max 3 tours.
 * @param {object} opts
 * @param {string} opts.provider - 'openai' | 'mistral'
 * @param {string} opts.llmKey - Clé API LLM
 * @param {string|null} opts.pappersKey - Clé API Pappers
 * @param {Array} opts.messages - Historique [{ role, content }] ou [{ role, content, tool_calls }, { role: 'tool', content, tool_call_id }]
 * @returns {Promise<{ reply: string, messages: Array, results: Array<{ siret, nom, adresse, formeJuridique }> }>}
 */
export async function runProspectChat({ provider, llmKey, pappersKey, messages }) {
  const baseUrl =
    provider === 'mistral'
      ? 'https://api.mistral.ai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  const model = provider === 'mistral' ? 'mistral-small-latest' : 'gpt-4o-mini';
  const systemPrompt = {
    role: 'system',
    content: `Tu es un assistant de prospection commerciale pour des indépendants et TPE françaises.
Tu aides à trouver des entreprises et artisans en France via la base SIRENE officielle et à donner des informations de contexte via le cadastre (parcelles autour d'une adresse).
Réponds toujours en français. Sois concis. Si tu dois chercher une ville, commence par appeler getCommune pour obtenir le département. Si la question concerne des parcelles ou le cadastre, appelle searchCadastre avec une adresse ou des coordonnées.
Format des résultats : pour chaque entreprise trouvée (type = 'sirene'), fournis nom, adresse, SIRET, forme juridique. Pour les résultats de type 'cadastre', fournis au moins commune, section, numéro de parcelle et surface approximative si disponible.`
  };

  const resultsCollector = [];
  let loopMessages = [systemPrompt, ...(Array.isArray(messages) ? messages : [])];

  for (let i = 0; i < 3; i++) {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmKey}`
      },
      body: JSON.stringify({
        model,
        messages: loopMessages,
        tools: TOOLS,
        tool_choice: 'auto'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message ?? data?.message ?? 'Erreur LLM';
      throw new Error(msg);
    }

    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('Réponse LLM vide');

    loopMessages.push(msg);

    if (!msg.tool_calls?.length) {
      return {
        reply: msg.content ?? 'Aucune réponse.',
        messages: loopMessages,
        results: [...resultsCollector]
      };
    }

    const toolResults = await Promise.all(
      msg.tool_calls.map(async (tc) => {
        let args = {};
        try {
          args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : {};
        } catch {
          return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'Arguments outil invalides (JSON)' }) };
        }
        const result = await executeTool(tc.function.name, args, pappersKey, resultsCollector);
        return {
          role: 'tool',
          tool_call_id: tc.id,
          content: typeof result === 'object' ? JSON.stringify(result) : String(result)
        };
      })
    );
    loopMessages.push(...toolResults);
  }

  return {
    reply: "Désolé, je n'ai pas pu traiter cette demande.",
    messages: loopMessages,
    results: [...resultsCollector]
  };
}

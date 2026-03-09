# IndexedDB — Référence par navigateur et plateforme

Document de travail : avantages, inconvénients, limites et bonnes pratiques.  
À valider et intégrer dans la doc projet après relecture.

---

## 1. Vue d’ensemble

IndexedDB est une API Web pour stocker des données structurées (objets, blobs) dans le navigateur, avec indexation et requêtes. Les données sont **par origine** (schéma + hostname + port). Pas de limite stricte par enregistrement dans la spec ; les limites viennent des **quotas par origine** et du comportement de chaque navigateur.

---

## 2. Support par navigateur et plateforme

### Desktop

| Navigateur      | Support complet      | Partiel / remarques                    |
|-----------------|----------------------|----------------------------------------|
| Chrome          | 23+                  | 11–22 partiel                          |
| Firefox         | 10+                  | 4–9 partiel                            |
| Safari          | 10+                  | 7.1–9.1 partiel                        |
| Edge            | 79+ (Chromium)       | 12–18 (legacy) partiel                 |
| Opera           | 15+                  | 10.5–12.1 non supporté                 |
| Internet Explorer | Partiel 10–11 seulement | Non supporté avant IE 10           |

### Mobile

| Plateforme           | Navigateur           | Support                               |
|----------------------|----------------------|----------------------------------------|
| iOS                  | Safari               | Complet 10+ ; 8–9.3 partiel            |
| iOS                  | Chrome / autres      | Moteur WebKit (iOS 17.4+ : moteurs alternatifs en UE) |
| Android              | Chrome               | Complet                                |
| Android              | Firefox              | Complet                                |
| Android              | Navigateur système   | 4.4+                                   |
| Android / autres      | Opera Mini           | Non supporté / limité                  |
| Samsung              | Samsung Internet     | Complet 4+                             |

### IndexedDB 2.0

Fonctionnalités type `getAll()`, clés binaires : Chrome 58+, Firefox 51+, Safari 10.1+, Edge 79+. **IE ne supporte pas** IndexedDB 2.0.

### Web Workers

IndexedDB utilisable dans les workers : Chrome 24+, Firefox 37+, Safari 10+, Edge.

---

## 3. Limites de stockage (quotas) par navigateur

Les chiffres sont des ordres de grandeur ; les navigateurs évitent des limites fixes pour limiter le fingerprinting.

### Chrome / Chromium (dont Edge)

- **Par origine** : jusqu’à **~60 % de la taille du disque** (ex. ~600 Go sur 1 To).
- Quota calculé sur la taille du disque, pas l’espace libre → en pratique on peut ne pas atteindre ce plafond.
- Pas de demande de permission explicite pour stocker (sauf pour la persistance, voir plus bas).

### Firefox

- **Best-effort** : le **minimum** entre 10 % du disque du profil et **10 GiB** (limite de groupe pour tous les sites du même “site”).
- **Persistant** (après `navigator.storage.persist()`) : jusqu’à **50 % du disque**, plafonné à 8 To ; pas soumis à la limite de groupe.
- Mobile : quota initial souvent très bas (ex. ~5 Mo) puis extension possible.

### Safari / WebKit (macOS 14, iOS 17+)

- **Application “navigateur”** (ex. Safari, navigateur par défaut) :
  - **Par origine** : ~**60 % du disque**.
  - **Toutes origines** : ~**80 % du disque**.
- **Autres apps** (ex. WebView) :
  - **Par origine** : ~**15 % du disque**.
  - **Toutes origines** : ~**20 % du disque**.
- PWA / “Add to Home Screen” : même quota que l’app navigateur (60 %).
- **Iframes cross-origin** : quota réduit (~10 % de celui du frame parent).
- Anciennes versions Safari : quota initial typique **~1 Go** par origine, puis demande à l’utilisateur pour augmenter. Depuis Safari 17, plus de prompt ; quotas basés sur le disque.

### Résumé pratique

| Navigateur / contexte | Ordre de grandeur par origine |
|----------------------|---------------------------------|
| Chrome / Edge (desktop) | Très élevé (~60 % disque)   |
| Firefox (desktop)       | 10 GiB (best-effort) ou 50 % disque (persistant) |
| Safari (navigateur)     | ~60 % disque (iOS 17+ / Sonoma+) ; ~1 Go sur anciennes versions |
| Safari (WebView / app)  | ~15 % disque                 |
| Firefox mobile          | Souvent faible au départ (quelques Mo) |

---

## 4. Avantages

- **Volume** : bien au-delà du Web Storage (5–10 Mo par origine) ; adapté au cache, médias, gros jeux de données.
- **Asynchrone** : pas de blocage du thread principal, contrairement à `localStorage`.
- **Requêtes et index** : index sur des propriétés, recherche sans tout charger en mémoire.
- **Types riches** : objets, Blob, ArrayBuffer, pas seulement des chaînes (pas de sérialisation JSON manuelle pour les structures).
- **Transactions** : opérations groupées, cohérence.
- **Standard** : pas déprécié (contrairement à Web SQL), supporté partout sauf vieux IE.

---

## 5. Inconvénients

- **Sécurité** : données lisibles par tout script de la même origine ; risque XSS si données sensibles non chiffrées.
- **API bas niveau** : API verbose ; souvent utilisé via une lib (Dexie, idb, etc.).
- **Performance** : passage par les couches sécurité du navigateur ; moins rapide qu’un accès disque direct.
- **Même origine** : pas d’accès cross-origin (comme le reste du stockage Web).
- **Comportement variable** : quotas et éviction différents selon navigateur et plateforme.

---

## 6. Limites et contraintes techniques

### Taille par enregistrement

- Pas de limite stricte dans la spec par valeur.
- En pratique : stocker de **très gros blobs** (ex. > ~120–133 Mo en ArrayBuffer dans Chrome) peut poser problème ; préférer des **Blob** (pas de sérialisation complète) ou découper en plusieurs enregistrements.
- **Clé auto-incrémentée** : max **2^53** (environ 9×10^15).

### Mode privé / navigation privée

- Données **souvent supprimées à la fermeture** de la session privée.
- Quotas peuvent être **réduits** ou différents.
- Firefox (depuis 2023) : IndexedDB en privé possible (fichiers chiffrés sur disque), mais toujours lié à la session privée.

### Éviction (suppression par le navigateur)

- **Best-effort** (défaut) : les données peuvent être **supprimées sans préavis** quand :
  - l’origine dépasse son quota,
  - le disque est en tension,
  - le navigateur applique une politique “max stockage” (ex. Chrome 80 % du disque).
- **Politique LRU** : les origines **les moins récemment utilisées** sont évincées en premier.
- **Important** : en cas d’éviction, **toute** la donnée de l’origine part (IndexedDB, Cache API, localStorage, etc.), pas seulement une base ou un store.
- **Safari** : éviction “proactive” si pas d’**interaction utilisateur** depuis **7 jours** (avec prévention du tracking activée). Les cookies serveur peuvent être exclus.
- **Persistant** : si `navigator.storage.persist()` est accordé, l’origine n’est pas évincée pour faire de la place ; suppression seulement par action explicite de l’utilisateur.

### Quota dépassé

- Les écritures (IndexedDB, Cache, OPFS, etc.) lèvent **`QuotaExceededError`** quand le quota est dépassé. À gérer en try/catch et en libérant de l’espace si besoin.

---

## 7. Persistance : `navigator.storage.persist()`

- **`navigator.storage.persist()`** : demande que le stockage de l’origine soit traité comme **persistant** (non évictable automatiquement).
- **`navigator.storage.persisted()`** : indique si la persistance a été accordée.
- **Comportement** :
  - **Firefox** : demande explicite à l’utilisateur (popup).
  - **Chrome / Edge** : accord/refus automatique selon heuristiques (site en favoris, PWA, notifications, etc.), pas de prompt.
  - **Safari** : pas de prompt ; décision interne.
- À appeler de préférence dans un **geste utilisateur** (ex. clic) quand on stocke des données critiques.

---

## 8. Vérifier l’espace : `navigator.storage.estimate()`

- **`navigator.storage.estimate()`** retourne une **estimation** de `quota` et `usage` pour l’origine.
- Les valeurs peuvent être volontairement imprécises (anti-fingerprinting).
- Utile pour adapter le comportement (cache, téléchargements, messages utilisateur) avant d’atteindre la limite.

---

## 9. Bonnes pratiques (résumé)

1. **Gérer QuotaExceededError** : try/catch sur toutes les écritures ; prévoir libération d’espace ou message clair.
2. **Gros fichiers** : privilégier **Blob** plutôt qu’ArrayBuffer ; découper si nécessaire (ex. plusieurs enregistrements).
3. **Données sensibles** : chiffrer côté client avant stockage (XSS = accès total à l’origine).
4. **Persistance** : appeler `navigator.storage.persist()` pour des données critiques, idéalement après un geste utilisateur.
5. **Sauvegardes** : ne pas considérer IndexedDB comme seule copie ; prévoir export/sync serveur ou fichier.
6. **Safari / iOS** : surveiller la **7-day proactive eviction** ; prévoir rafraîchissement ou rappel d’utilisation pour les apps sensibles aux données.
7. **État en mémoire** : garder un état minimal en mémoire pour que l’app reste utilisable si le stockage est indisponible (privé, éviction, erreur).

---

## 10. Sources (à garder pour la doc finale)

- MDN – Storage quotas and eviction criteria  
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria  
- MDN – IndexedDB API  
  https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API  
- Can I use – IndexedDB / IndexedDB 2.0  
  https://caniuse.com/indexeddb  
- web.dev – Persistent storage  
  https://web.dev/articles/persistent-storage  
- web.dev – Storage for the web  
  https://web.dev/articles/storage-for-the-web  
- WebKit – Updates to Storage Policy (Safari 17, iOS 17)  
  https://webkit.org/blog/14403/updates-to-storage-policy/  
- Stack Overflow / articles Medium et blog (avantages/inconvénients, limites par navigateur, bonnes pratiques).

---

*Document agrégé à partir de recherches web (mars 2025). À relire et adapter avant publication.*

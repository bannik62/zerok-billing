# Index des schémas et diagrammes

Ce document recense les schémas du projet zerok-billing, leur emplacement et leur objectif.

> Dernière mise à jour : 2026-02-27 — Ajout du modèle `UserBackup` et des séquences backup/multiposte.

---

## 1. Schémas disponibles

| Document / fichier | Format | Emplacement | Objectif |
|-------------------|--------|-------------|----------|
| **schema.drawio** | Draw.io | `docs/schema.drawio` | Architecture 3-tiers : Backend (Express, Auth, Session, Proof, DocumentProof, UserBackup), Frontend (Svelte, modules), Database (PostgreSQL, IndexedDB). |
| **schemaMermaid.svg** | SVG (export Mermaid) | `frontend/src/assets/schemaMermaid.svg` | Schéma détaillé (workflow ou architecture). |
| **WORKFLOWS.md** | ASCII | `docs/WORKFLOWS.md` | Flux au démarrage, login, dérivation de clé, backup sync, multiposte. |
| **auth-session-derivation-cle.md** | Mermaid | `docs/auth-session-derivation-cle.md` | Connexion/session, dérivation de clé, backup sync, déconnexion. |
| **MIGRATIONS_FRONTEND.md** | Mermaid | `docs/MIGRATIONS_FRONTEND.md` | Migrations Dexie et migration métier legacy. |
| **SAUVEGARDE_ZERO_KNOWLEDGE.md** | ASCII + tableaux | `docs/SAUVEGARDE_ZERO_KNOWLEDGE.md` | Sauvegarde serveur chiffrée, multiposte, export manuel. |

---

## 2. ERD – Relations de données (Mermaid)

Modèle conceptuel : backend (PostgreSQL) et frontend (IndexedDB).

```mermaid
erDiagram
  User ||--o{ Proof : "détient"
  User ||--o{ DocumentProof : "détient"
  User ||--o| SignRequest : "crée"
  User ||--o| UserBackup : "possède"
  Invoice ..> Proof : "hash vérifié par"
  Document ..> DocumentProof : "hash vérifié par"

  User {
    string id PK
    string email
    string passwordHash
    string recoverySalt
    string recoveryKeyCheck
  }

  UserBackup {
    string id PK
    string userId FK "UNIQUE"
    string payload "Archive chiffrée (TEXT) – opaque pour le serveur"
    string stateHash "SHA-256 du bundle canonique (côté client)"
    datetime updatedAt
  }

  Proof {
    string id PK
    string userId FK
    string invoiceId
    string invoiceHash
    datetime signedAt
  }

  DocumentProof {
    string id PK
    string userId FK
    string documentId FK
    string documentHash
    string filename
    string mimeType
    int size
  }

  SignRequest {
    string id PK
    string userId FK
    string token
    string email
    datetime expiresAt
  }

  Invoice {
    string id
    string type "devis|facture"
  }

  Document {
    string id
    string clientId
    string linkedInvoiceId
    string type
  }
```

- **Backend (PostgreSQL)** : User, Proof, DocumentProof, SignRequest, UserBackup (et Session via connect-pg-simple).
- **Frontend (IndexedDB)** : clients, societe, devis, factures, documents, meta. Les devis/factures sont chiffrés (payload + iv). Le coffre (`documents`) a un hash envoyé au backend pour DocumentProof.
- **UserBackup** : le serveur stocke un blob opaque (archive chiffrée complète) et son hash. Il ne peut pas déchiffrer ce contenu.

---

## 3. Séquence – Sync backup au déverrouillage

```mermaid
sequenceDiagram
  participant U as Utilisateur
  participant F as Frontend (backupSync.js)
  participant IDB as IndexedDB
  participant B as Backend
  participant PG as PostgreSQL

  U->>F: Déverrouillage (mot de passe)
  F->>IDB: buildBundle(uid)
  alt Bundle vide
    F->>B: GET /api/backup
    alt 404 – rien sur le serveur
      B-->>F: 404
    else 200 – blob disponible
      B-->>F: { payload, stateHash }
      F->>F: openArchive(payload, password) [déchiffrement local]
      F->>IDB: applyRestore(uid, bundle)
      F->>B: PUT /api/backup (hash réaligné)
    end
  else Bundle non vide
    F->>F: computeStateHash(bundle)
    F->>B: GET /api/backup?hash=<hash>
    alt unchanged
      B-->>F: { unchanged: true }
    else stale ou absent
      B-->>F: { payload, stateHash } ou 404
      F->>F: openArchive + applyRestore (si payload)
      F->>B: PUT /api/backup (si restauration)
    end
  end
  F->>U: Menu disponible
```

---

## 4. Séquence – Upload document coffre-fort et preuve

```mermaid
sequenceDiagram
  participant U as Utilisateur
  participant F as Frontend
  participant IDB as IndexedDB
  participant B as Backend
  participant PG as PostgreSQL

  U->>F: Sélectionne fichier + client + type + lien facture
  F->>F: hashFile(fichier) [SHA-256]
  F->>F: encryptFile(fichier, clé) [AES-GCM]
  F->>IDB: documents.add(record chiffré + metadata)
  F->>B: POST /api/documents/proof { hash, documentId, filename, mimeType, size, ... }
  B->>PG: DocumentProof upsert (userId, documentId, hash, ...)
  B-->>F: 201 Created
  F-->>U: Document ajouté
```

- Le contenu du fichier ne quitte jamais le frontend (chiffré en local).
- Le backend ne stocke que le hash et les métadonnées pour la preuve d'intégrité.

---

## 5. Séquence – Vérification des preuves (intégrité)

```mermaid
sequenceDiagram
  participant F as Frontend
  participant B as Backend
  participant IDB as IndexedDB

  F->>B: GET /api/proofs (cookie session)
  B->>B: requireAuth
  B-->>F: { proofs: [ { invoiceId, invoiceHash, signedAt }, ... ] }
  F->>IDB: getAllDevis / getAllFactures (déchiffrés)
  F->>F: Pour chaque proof : hashDocument(doc) === invoiceHash ?
  F->>F: Affiche statut (conforme / diff / orphelin) dans ProofsPanel
```

- Les preuves côté serveur sont comparées au hash local calculé sur le document déchiffré.
- Permet de détecter une incohérence entre le contenu local et ce qui a été signé.

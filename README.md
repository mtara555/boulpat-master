# 🥖 BOULPAT MASTER

![Deploy](https://github.com/mtara555/boulpat-master/actions/workflows/deploy.yml/badge.svg)

PWA de gestion des fiches techniques et ordres de fabrication
pour le rayon **Boulangerie-Pâtisserie**.

## 🌐 Application en ligne

👉 **https://mtara555.github.io/boulpat-master/**

## ✨ Fonctionnalités

- 📋 Fiches techniques standardisées et modifiables
- 🌍 Bilingue Français / العربية avec switch instantané
- 🧮 Calculs automatiques (prix de revient, marge, rendement)
- ⚠️ Détection automatique des 14 allergènes réglementaires
- 📱 PWA installable, fonctionne hors ligne au fournil
- 👥 Rôles utilisateurs (Chef / Équipe / Moniteur)
- 🏭 4 familles : Boulangerie fabriquée, Négoce, Viennoiserie, Pâtisserie

## 🚀 Stack technique

- **Frontend** : PWA vanilla (HTML/CSS/JS, sans framework)
- **Déploiement** : GitHub Pages + GitHub Actions
- **Base de données** : Firebase Firestore (cache hors ligne, temps réel)
- **Auth** : Firebase Authentication (e-mail/mot de passe + Google), rôles dans Firestore

## 📅 Roadmap

- [x] Étape 1 — Comptes & outils
- [x] Étape 2 — Déploiement automatique GitHub Pages
- [x] Étape 3 — Firebase (Firestore + Auth)
- [x] Étape 4 — Sync temps réel des fiches
- [x] Étape 5 — Module Fabrication (Ordres de Fabrication)
- [x] Étape 6 — Mode Terrain (minuteur, offline)
- [x] Fichiers source du moniteur, photos/vidéos des étapes, QR code, export PDF
- [x] Étape 7 — HACCP, traçabilité des lots, étiquettes allergènes (V2)
- [ ] Étape 8 — PWA installable + notifications

---

*Projet privé — La Pâtisserie / BoulPat Master*

## Cloud Storage (fichier source, vidéos des étapes)

1. Console Firebase → **Storage** → *Commencer* (le plan Blaze peut être exigé ; il reste gratuit dans les quotas).
2. Onglet **Règles** → collez le contenu de `storage.rules` → *Publier*.
3. Sans Storage, tout fonctionne sauf l'envoi du fichier source et des vidéos (les photos des étapes sont intégrées à la fiche).

## V2 — Qualité (onglet « Qualité »)

- **Températures** : équipements et seuils configurables (Chef), relevés horodatés, action corrective obligatoire hors limites.
- **Nettoyage** : plan quotidien / hebdomadaire à cocher, historique par jour.
- **Lots reçus** : registre (ingrédient, n° de lot, fournisseur, DLC) avec alertes périmé / < 7 jours.
- **Traçabilité** : n° de lot saisi dans chaque OF ; recherche d'un lot → OF et produits concernés.
- **Étiquettes** : depuis une fiche (bouton « Étiquette »), FR / AR, A7 · A6 · 100×70 mm. Modèle indicatif à faire valider (ONSSA / responsable qualité).

Collections Firestore : `equipements`, `taches`, `releves`, `nettoyages`, `lots`, `config/etiquette` (voir `firestore.rules`).

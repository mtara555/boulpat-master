// firebase-config.js
// ============================================================
// BOULPAT MASTER — Configuration Firebase
// ------------------------------------------------------------
// ⚠️ IMPORTANT : Ces clés sont PUBLIQUES par design.
//    Google recommande de les exposer dans le code source.
//    La sécurité vient des RÈGLES FIRESTORE, pas de ces clés.
//    Ne JAMAIS mettre ici de serviceAccountKey.json (secret serveur).
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDV94C3SF3gys83bQ1N7ycgYpTNkbDxEpA",
  authDomain: "boulpat-master-5e368.firebaseapp.com",
  projectId: "boulpat-master-5e368",
  storageBucket: "boulpat-master-5e368.firebasestorage.app",
  messagingSenderId: "669423086380",
  appId: "1:669423086380:web:3861c01f54cbba19321a89"
};

// ============================================================
// IDENTIFIANT ENTREPRISE
// ------------------------------------------------------------
// Racine multi-tenant dans Firestore :
//   companies/{COMPANY_ID}/fiches/{ficheId}
//   companies/{COMPANY_ID}/ofs/{ofId}
//
// Pour l'instant : une seule entreprise ("la-patisserie").
// Plus tard : on pourra gérer plusieurs enseignes / franchisés
// en changeant simplement cette valeur (ou en la rendant dynamique).
// ============================================================

export const COMPANY_ID = "la-patisserie";

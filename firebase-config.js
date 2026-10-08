// firebase-config.js
// Configuration Firebase publique — versionnée dans le repo
// ⚠️ Ces clés sont PUBLIQUES par design (Google recommande de les exposer)
// La sécurité vient des règles Firestore, pas de ces clés.

export const firebaseConfig = {
  apiKey: "AIzaSyDV94C3SF3gys83bQ1N7ycgYpTNkbDxEpA",
  authDomain: "boulpat-master-5e368.firebaseapp.com",
  projectId: "boulpat-master-5e368",
  storageBucket: "boulpat-master-5e368.firebasestorage.app",
  messagingSenderId: "669423086380",
  appId: "1:669423086380:web:3861c01f54cbba19321a89"
};

// Identifiant de votre "entreprise" — utilisé comme racine dans Firestore
// Pour l'instant fixe, plus tard on gérera plusieurs entreprises
export const COMPANY_ID = "la-patisserie";

// firebase-sync.js
// ============================================================
// BOULPAT MASTER — Couche de synchronisation Firebase ↔ PWA
// ------------------------------------------------------------
//  • Authentification : Email/Password + Google
//  • Firestore : sync temps réel des fiches et ordres de fabrication
//  • Offline-first : cache IndexedDB persistant
//  • Migration : localStorage → cloud à la première connexion
// ============================================================

import { firebaseConfig, COMPANY_ID } from './firebase-config.js';

// --- SDK Firebase v10 modulaire (CDN, pas de build) ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  enableIndexedDbPersistence,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Initialisation ---
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Session persistante : reste connecté après fermeture du navigateur
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Offline-first : Firestore conserve un cache IndexedDB local
// → l'app continue de fonctionner au fournil sans WiFi
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firestore] Multi-onglets : cache persistant limité');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firestore] Navigateur sans support IndexedDB');
  }
});

// ============================================================
// AUTHENTIFICATION
// ============================================================

/**
 * Écoute les changements d'état de connexion.
 * @param {(user: Object|null) => void} cb
 * @returns {Function} fonction de désinscription
 */
export function watchAuth(cb){
  return onAuthStateChanged(auth, user => cb(user));
}

export const loginEmail   = (email, pwd) => signInWithEmailAndPassword(auth, email, pwd);
export const signupEmail  = (email, pwd) => createUserWithEmailAndPassword(auth, email, pwd);
export const loginGoogle  = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout       = () => signOut(auth);

// ============================================================
// FIRESTORE — FICHES TECHNIQUES
// ============================================================

const fichesCol = () => collection(db, 'companies', COMPANY_ID, 'fiches');

/**
 * Écoute temps réel de toutes les fiches de l'entreprise.
 * Toute modification cloud est immédiatement poussée au client.
 */
export function watchFiches(cb){
  return onSnapshot(fichesCol(),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('[Firestore] watchFiches :', err)
  );
}

/** Enregistre (crée ou met à jour) une fiche dans le cloud */
export async function saveFiche(f){
  const ref = doc(db, 'companies', COMPANY_ID, 'fiches', f.id);
  const { id, ...data } = f;
  await setDoc(ref, { ...data, _syncedAt: serverTimestamp() }, { merge: true });
}

/** Supprime une fiche du cloud */
export async function deleteFiche(id){
  await deleteDoc(doc(db, 'companies', COMPANY_ID, 'fiches', id));
}

/**
 * Migration : envoie toutes les fiches locales vers Firestore (une seule fois).
 * @param {Array} localFiches
 * @returns {Promise<number>} nombre de fiches synchronisées
 */
export async function migrateLocalToCloud(localFiches){
  const results = await Promise.allSettled(localFiches.map(saveFiche));
  const ok = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[Migration] ${ok}/${localFiches.length} fiches synchronisées`);
  return ok;
}

// Marqueur pour ne migrer qu'une seule fois par appareil
const MIGRATE_KEY = 'bpm.migrated.' + COMPANY_ID;
export const hasMigrated  = () => localStorage.getItem(MIGRATE_KEY) === '1';
export const markMigrated = () => localStorage.setItem(MIGRATE_KEY, '1');

// ============================================================
// FIRESTORE — ORDRES DE FABRICATION (OF)
// ============================================================

const ofsCol = () => collection(db, 'companies', COMPANY_ID, 'ofs');

/**
 * Enregistre un Ordre de Fabrication dans Firestore.
 * L'OF est immuable : on écrase le document si même id (OF du jour réédité).
 * @param {Object} of  OF généré par of-engine.js
 * @returns {Promise<string>} id de l'OF
 */
export async function saveOF(of){
  const ref = doc(db, 'companies', COMPANY_ID, 'ofs', of.id);
  const { id, ...data } = of;
  await setDoc(ref, { ...data, _savedAt: serverTimestamp() }, { merge: false });
  return of.id;
}

/** Supprime un OF du cloud (rare — utile pour tests) */
export async function deleteOF(id){
  await deleteDoc(doc(db, 'companies', COMPANY_ID, 'ofs', id));
}

/**
 * Écoute temps réel de tous les OF.
 * Utile pour l'historique et le mode terrain.
 */
export function watchOFs(cb){
  return onSnapshot(ofsCol(),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('[Firestore] watchOFs :', err)
  );
}

/**
 * Charge un OF spécifique depuis le cloud (par id).
 * Pour éviter d'embarquer tout le SDK getDoc, on utilise onSnapshot one-shot.
 */
export function loadOF(id, cb){
  const ref = doc(db, 'companies', COMPANY_ID, 'ofs', id);
  return onSnapshot(ref, snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() });
    else cb(null);
  });
}

// ============================================================
// EXPORTS UTILITAIRES (pour débogage éventuel)
// ============================================================
export { COMPANY_ID };

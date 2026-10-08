// firebase-sync.js
// Couche de synchronisation Firebase ↔ PWA locale
// - Auth : email/password + Google
// - Firestore : sync temps réel des fiches
// - Offline-first : localStorage reste la source de vérité locale

import { firebaseConfig, COMPANY_ID } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot,
  enableIndexedDbPersistence, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Persistance : la session survit à la fermeture du navigateur
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Offline-first : Firestore garde un cache IndexedDB local
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') console.warn('Multi-onglets : cache limité');
  else if (err.code === 'unimplemented')  console.warn('Navigateur sans IndexedDB');
});

// ============ AUTH ============
export function watchAuth(cb){
  return onAuthStateChanged(auth, user => cb(user));
}
export const loginEmail    = (email, pwd) => signInWithEmailAndPassword(auth, email, pwd);
export const signupEmail   = (email, pwd) => createUserWithEmailAndPassword(auth, email, pwd);
export const loginGoogle   = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout        = () => signOut(auth);

// ============ FIRESTORE : FICHES ============
const fichesCol = () => collection(db, 'companies', COMPANY_ID, 'fiches');

/** Écoute temps réel de toutes les fiches de l'entreprise */
export function watchFiches(cb){
  return onSnapshot(fichesCol(),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error('[Firestore] watchFiches', err)
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

/** Migration : envoie toutes les fiches locales vers Firestore (une seule fois) */
export async function migrateLocalToCloud(localFiches){
  const results = await Promise.allSettled(localFiches.map(saveFiche));
  const ok = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[Migration] ${ok}/${localFiches.length} fiches synchronisées`);
  return ok;
}

/** Marqueur pour ne migrer qu'une seule fois par utilisateur */
const MIGRATE_KEY = 'bpm.migrated.' + COMPANY_ID;
export const hasMigrated  = () => localStorage.getItem(MIGRATE_KEY) === '1';
export const markMigrated = () => localStorage.setItem(MIGRATE_KEY, '1');

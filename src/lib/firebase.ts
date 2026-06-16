// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ── Primary app (for the logged-in admin) ────────────────────────────────────
function getFirebaseApp(): FirebaseApp {
  const existing = getApps().find(a => a.name === '[DEFAULT]');
  if (existing) return existing;
  return initializeApp(firebaseConfig);
}

export const getDbInstance   = () => getFirestore(getFirebaseApp());
export const getAuthInstance = () => getAuth(getFirebaseApp());
export const db   = typeof window !== 'undefined' ? getFirestore(getFirebaseApp()) : null as any;
export const auth = typeof window !== 'undefined' ? getAuth(getFirebaseApp())      : null as any;

// ── Secondary app (creates staff accounts WITHOUT logging out admin) ──────────
const SECONDARY = 'SecondaryApp';

function getSecondaryApp(): FirebaseApp {
  const existing = getApps().find(a => a.name === SECONDARY);
  if (existing) return existing;
  return initializeApp(firebaseConfig, SECONDARY);
}

// Creates a Firebase Auth account for a staff member
// Returns the new user's UID
export async function createStaffAccount(email: string, password: string): Promise<string> {
  const secondaryAuth = getAuth(getSecondaryApp());
  const result = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await secondaryAuth.signOut(); // sign out of secondary immediately
  return result.user.uid;
}

// Change current logged-in user's password (requires re-auth first)
export async function changeCurrentUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user || !user.email) throw new Error('No user logged in.');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

// Generates a secure random temporary password
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
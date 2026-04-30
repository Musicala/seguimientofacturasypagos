import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { APP_CONFIG } from "./firebase.config.js";

export const firebaseApp = initializeApp(APP_CONFIG.firebase);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

const provider = new GoogleAuthProvider();

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}

export async function getAuthorizedProfile(user) {
  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const profile = { uid: user.uid, ...userSnap.data() };
    if (profile.active === false) return null;
    return profile;
  }

  if (!APP_CONFIG.allowedEmails.includes(email)) return null;

  const profile = {
    uid: user.uid,
    email,
    name: user.displayName || email,
    role: email === "alekcaballeromusic@gmail.com" ? "admin" : "editor",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(userRef, profile, { merge: true });
  return { ...profile, createdAt: null, updatedAt: null };
}

export { doc, getDoc, setDoc, serverTimestamp };

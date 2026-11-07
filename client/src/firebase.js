import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" }); // always show the account picker
export const auth = getAuth(app);
export const login = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);

// Fresh token on every call; Firebase refreshes it automatically before it expires (1 hour)
export async function authHeaders() {
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

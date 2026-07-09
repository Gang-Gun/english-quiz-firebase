import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { getFirebaseConfig, hasFirebaseConfig } from "./config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;

export function getFirebaseClient() {
  if (!hasFirebaseConfig()) return null;
  if (!app) {
    app = initializeApp(getFirebaseConfig());
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app, "asia-northeast3");
  }
  return { app, auth: auth!, db: db!, functions: functions! };
}

export async function signInAdminWithGoogle() {
  const client = getFirebaseClient();
  if (!client) throw new Error("Firebase 환경 변수가 없습니다.");
  const provider = new GoogleAuthProvider();
  return signInWithPopup(client.auth, provider);
}

export function callable<TInput, TOutput>(name: string) {
  const client = getFirebaseClient();
  if (!client) return null;
  return httpsCallable<TInput, TOutput>(client.functions, name);
}

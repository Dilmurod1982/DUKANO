import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyCqFHYXvAIKTa2c0Wd4hk2F6-7wwMMN6G4",
    authDomain: "dukano-cf9e8.firebaseapp.com",
    projectId: "dukano-cf9e8",
    storageBucket: "dukano-cf9e8.firebasestorage.app",
    messagingSenderId: "904959867790",
    appId: "1:904959867790:web:0f7511738e2c52e26dc2df"
  };

// Инициализируем приложение один раз (защита от HMR и повторных импортов)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// --- Основной Auth (для логина админа/пользователей) ---
export const auth = getAuth(app);

// --- Firestore, Storage, Functions ---
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

// --- Вторичный Auth (только для создания пользователей без выкидывания админа) ---
// Firebase позволяет создать второй экземпляр Auth с уникальным именем.
// Его сессия полностью изолирована от основного auth.
let _secondaryAuth;
try {
  _secondaryAuth = initializeAuth(app, {
    name: "secondary",
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  });
} catch (e) {
  // Если уже инициализирован (например, при HMR) — получаем существующий
  _secondaryAuth = getAuth(app, "secondary");
}

export const secondaryAuth = _secondaryAuth;

export default app;
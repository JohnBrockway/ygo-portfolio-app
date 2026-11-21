import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCf3ibM-uFnv8JDaCwcW9jN4X_v1WChjz4",
  authDomain: "ygo-portfolio.firebaseapp.com",
  projectId: "ygo-portfolio",
  storageBucket: "ygo-portfolio.firebasestorage.app",
  messagingSenderId: "951720324255",
  appId: "1:951720324255:web:2fb01db0b3d6005a9646aa"
};

export const firebaseApp = initializeApp(firebaseConfig);

// Firebase Auth keeps the signed-in user in the browser (IndexedDB), so sign-in survives reload and is shared across tabs.
export const firebaseAuth = getAuth(firebaseApp);
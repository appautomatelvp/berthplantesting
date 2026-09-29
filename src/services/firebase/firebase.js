import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBRshRSrp69UryJc8BOrmj65RhoPADGtqk",
  authDomain: "berthingplanmng.firebaseapp.com",
  projectId: "berthingplanmng",
  storageBucket: "berthingplanmng.firebasestorage.app",
  messagingSenderId: "302091519503",
  appId: "1:302091519503:web:6191e9beb22a0683ca057a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Helper function to sign in anonymously
export const signInAnonymousUser = () => {
  return signInAnonymously(auth);
};

// Document ID for real-time state
export const STATE_DOC_ID = "state";
export const STATE_COLLECTION = "berthingPlanData";

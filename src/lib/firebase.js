import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBRshRSrp69UryJc8BOrmj65RhoPADGtqk",
  authDomain: "berthingplanmng.firebaseapp.com",
  projectId: "berthingplanmng",
  storageBucket: "berthingplanmng.firebasestorage.app",
  messagingSenderId: "302091519503",
  appId: "1:302091519503:web:6191e9beb22a0683ca057a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app;

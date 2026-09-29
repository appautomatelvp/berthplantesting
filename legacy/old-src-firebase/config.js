import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = { 
    apiKey: "AIzaSyBXRwurRyERLg_bdZKcLtLr68UpalQkEeA", 
    authDomain: "cmit-berth-planner.firebaseapp.com", 
    projectId: "cmit-berth-planner", 
    storageBucket: "cmit-berth-planner.firebasestorage.app", 
    messagingSenderId: "43356799872", 
    appId: "1:43356799872:web:86d1daac85a9b6e2def765" 
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const authentication = getAuth(app);

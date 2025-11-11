import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBEtgLRIuCqT64BFeJ7MTbYT9rzE-rHpeY",
  authDomain: "websitetest-51899.firebaseapp.com",
  projectId: "websitetest-51899",
  storageBucket: "websitetest-51899.firebasestorage.app",
  messagingSenderId: "123979363835",
  appId: "1:123979363835:web:0c5cfa780690087ef2075e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

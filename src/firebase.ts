import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCdzDUwbE5afQXLtWxgdeBtCCbOzq0lGLw",
  authDomain: "opal-dining.firebaseapp.com",
  projectId: "opal-dining",
  storageBucket: "opal-dining.firebasestorage.app",
  messagingSenderId: "278113592385",
  appId: "1:278113592385:web:7996a12f73bb241eeb12c0"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
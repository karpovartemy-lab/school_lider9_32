import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDafdcFSTURexXb49Nshik2AaZMSY3I-Ok",
  authDomain: "lider-3bf7f.firebaseapp.com",
  databaseURL: "https://lider-3bf7f-default-rtdb.firebaseio.com",
  projectId: "lider-3bf7f",
  storageBucket: "lider-3bf7f.firebasestorage.app",
  messagingSenderId: "900376444018",
  appId: "1:900376444018:web:33b6c1a1ca8773e63a16eb",
  measurementId: "G-M00X8N0FJX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const rtdb = getDatabase(app);

export default app;

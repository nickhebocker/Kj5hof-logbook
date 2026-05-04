const firebaseConfig = {
  apiKey: "AIzaSyCuPlkWdIBTGsmpEQdmy0wTqrVJadL29kE",
  authDomain: "logbook-75575.firebaseapp.com",
  projectId: "logbook-75575",
  storageBucket: "logbook-75575.firebasestorage.app",
  messagingSenderId: "700088204207",
  appId: "1:700088204207:web:33b3c5cc221f02a2b2cd5a"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
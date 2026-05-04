import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCuPlkWdIBTGsmpEQdmy0wTqrVJadL29kE",
    authDomain: "logbook-75575.firebaseapp.com",
    projectId: "logbook-75575",
    storageBucket: "logbook-75575.firebasestorage.app",
    messagingSenderId: "700088204207",
    appId: "1:700088204207:web:33b3c5cc221f02a2b2cd5a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- AUTHENTICATION LOGIC ---
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginOverlay.style.display = 'none';
        appContainer.style.display = 'block';
        renderLogs();
        map.invalidateSize(); // Fixes Leaflet sizing after reveal
    } else {
        loginOverlay.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Login failed: " + err.message));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- EXISTING LOGIC ---
const map = L.map('map').setView([31.9686, -99.9018], 6); 
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const LOCAL_STORAGE_KEY = 'kj5hof_logs';

function getLocalLogs() {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
}

function renderLogs() {
    const logEntries = document.getElementById('log-entries');
    const logs = getLocalLogs();
    logEntries.innerHTML = logs.map(log => `
        <div class="log-item">
            <strong>${log.callsign}</strong> - ${log.frequency}MHz (${log.mode})<br>
            <small>${new Date(log.timestamp).toLocaleString()}</small>
            <p>${log.notes}</p>
        </div>
    `).join('');
}

document.getElementById('log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Must be logged in to save.");

    const entry = {
        id: Date.now(),
        uid: auth.currentUser.uid, // Tie log to your user
        timestamp: new Date().toISOString(),
        callsign: document.getElementById('callsign').value.toUpperCase(),
        frequency: document.getElementById('frequency').value,
        mode: document.getElementById('mode').value,
        rstSent: document.getElementById('rstSent').value,
        rstRcvd: document.getElementById('rstRcvd').value,
        notes: document.getElementById('notes').value
    };

    const logs = getLocalLogs();
    logs.unshift(entry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    renderLogs();

    if (navigator.onLine) {
        try {
            await addDoc(collection(db, "logs"), { ...entry, createdAt: serverTimestamp() });
        } catch (err) { console.error("Firebase Error", err); }
    }
    e.target.reset();
});

window.addEventListener('online', () => document.getElementById('connection-status').innerText = "Online");
window.addEventListener('offline', () => document.getElementById('connection-status').innerText = "Offline");

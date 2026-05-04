import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
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

// --- MAP INITIALIZATION ---
const map = L.map('map').setView([31.9686, -99.9018], 6); 
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// --- LOGIN POP-UP ERROR HANDLING ---
const loginBtn = document.getElementById('login-btn');
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');

// Monitor Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginOverlay.style.display = 'none';
        appContainer.style.display = 'block';
        setTimeout(() => map.invalidateSize(), 400); // Fixes map on reveal
    } else {
        loginOverlay.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

// Login Execution with Mobile Pop-up Errors
loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    if (!email || !pass) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        // This creates the pop-up error on your mobile screen
        console.error("Login failed:", error.code);
        
        switch (error.code) {
            case 'auth/invalid-credential':
                alert("Error: Invalid email or password. Please try again.");
                break;
            case 'auth/user-not-found':
                alert("Error: No account found with this email.");
                break;
            case 'auth/wrong-password':
                alert("Error: Incorrect password.");
                break;
            case 'auth/network-request-failed':
                alert("Error: Network issue. Check your connection.");
                break;
            default:
                alert("Login Error: " + error.message);
        }
    }
});

// Logout logic
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- EXISTING LOGGING LOGIC ---
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
        </div>
    `).join('');
}

document.getElementById('log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const entry = {
        id: Date.now(),
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

    if (navigator.onLine && auth.currentUser) {
        try {
            await addDoc(collection(db, "logs"), { 
                ...entry, 
                uid: auth.currentUser.uid, 
                createdAt: serverTimestamp() 
            });
        } catch (err) {
            console.error("Cloud Sync Failed", err);
        }
    }
    e.target.reset();
});

renderLogs();

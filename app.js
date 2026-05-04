import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- FIREBASE CONFIG ---
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
const LOCAL_STORAGE_KEY = 'kj5hof_log_data';

// --- INITIALIZE MAP ---
const map = L.map('map').setView([30.2672, -97.7431], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// --- APP FUNCTIONS ---

function getLocalLogs() {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
}

function renderLogs() {
    const logList = document.getElementById('log-entries');
    const logs = getLocalLogs();
    logList.innerHTML = logs.map(log => `
        <div class="log-item ${log.cloudSynced ? 'synced' : 'pending'}">
            <strong>${log.callsign}</strong> | ${log.frequency} | ${log.mode} | 
            RST: ${log.rstSent}/${log.rstRcvd} | <span>${log.cloudSynced ? '✓' : '☁'}</span>
            <p>${log.notes}</p>
            <small>${new Date(log.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
}

async function syncToFirebase(entry) {
    if (!navigator.onLine) return;
    try {
        await addDoc(collection(db, "logs"), {
            ...entry,
            createdAt: serverTimestamp()
        });
        const logs = getLocalLogs();
        const idx = logs.findIndex(l => l.id === entry.id);
        if (idx !== -1) {
            logs[idx].cloudSynced = true;
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
            renderLogs();
        }
    } catch (e) { console.error("Sync Error", e); }
}

// --- EVENTS ---

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
        notes: document.getElementById('notes').value,
        cloudSynced: false
    };

    const logs = getLocalLogs();
    logs.unshift(entry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    renderLogs();
    e.target.reset();
    
    await syncToFirebase(entry);
});

window.addEventListener('online', () => {
    document.getElementById('connection-status').innerText = "Online";
    getLocalLogs().filter(l => !l.cloudSynced).forEach(syncToFirebase);
});

window.addEventListener('offline', () => {
    document.getElementById('connection-status').innerText = "Offline (Local Mode)";
});

// Initial Load
renderLogs();
if (navigator.onLine) {
    getLocalLogs().filter(l => !l.cloudSynced).forEach(syncToFirebase);
}

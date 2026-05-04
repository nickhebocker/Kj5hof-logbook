import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- FIREBASE SETUP ---
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
const LOCAL_STORAGE_KEY = 'kj5hof_log_data_v1';

// --- DOM ELEMENTS ---
const logForm = document.getElementById('log-form');
const logList = document.getElementById('log-entries');
const statusEl = document.getElementById('connection-status');

// --- APP LOGIC ---

function getLocalLogs() {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
}

function renderLogs() {
    const logs = getLocalLogs();
    logList.innerHTML = '';
    
    if (logs.length === 0) {
        logList.innerHTML = '<p class="empty-msg">No logs saved yet.</p>';
        return;
    }

    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = `log-card ${log.cloudSynced ? 'synced' : 'pending'}`;
        div.innerHTML = `
            <div class="card-top">
                <span class="card-call">${log.callsign}</span>
                <span class="card-mode">${log.frequency} | ${log.mode}</span>
                <span class="sync-indicator">${log.cloudSynced ? '✓' : '☁'}</span>
            </div>
            <div class="card-rst">RST: ${log.rstSent}/${log.rstRcvd}</div>
            <div class="card-notes">${log.notes}</div>
            <div class="card-time">${new Date(log.timestamp).toLocaleTimeString()} - ${new Date(log.timestamp).toLocaleDateString()}</div>
        `;
        logList.appendChild(div);
    });
}

async function syncEntryToFirebase(entry) {
    if (!navigator.onLine) return;

    try {
        await addDoc(collection(db, "logs"), {
            callsign: entry.callsign,
            frequency: entry.frequency,
            mode: entry.mode,
            rstSent: entry.rstSent,
            rstRcvd: entry.rstRcvd,
            notes: entry.notes,
            timestamp: entry.timestamp,
            createdAt: serverTimestamp()
        });

        // Update local status after successful cloud save
        const logs = getLocalLogs();
        const index = logs.findIndex(l => l.id === entry.id);
        if (index !== -1) {
            logs[index].cloudSynced = true;
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
            renderLogs();
        }
    } catch (error) {
        console.error("Sync error:", error);
    }
}

async function backgroundSync() {
    if (!navigator.onLine) return;
    const logs = getLocalLogs();
    const unsynced = logs.filter(l => !l.cloudSynced);
    for (const log of unsynced) {
        await syncEntryToFirebase(log);
    }
}

// --- EVENT HANDLERS ---

logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newEntry = {
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

    // 1. Save Locally
    const logs = getLocalLogs();
    logs.unshift(newEntry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    renderLogs();
    
    // 2. Clear Form
    logForm.reset();
    document.getElementById('callsign').focus();

    // 3. Try Firebase
    await syncEntryToFirebase(newEntry);
});

function updateStatus() {
    if (navigator.onLine) {
        statusEl.innerText = "ONLINE";
        statusEl.className = "online";
        backgroundSync();
    } else {
        statusEl.innerText = "OFFLINE (Local Mode)";
        statusEl.className = "offline";
    }
}

window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

// Boot app
updateStatus();
renderLogs();

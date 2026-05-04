import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
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
const LOCAL_STORAGE_KEY = 'kj5hof_logs';

// UI Elements
const logModal = document.getElementById('logbook-modal');
const logGridBody = document.getElementById('log-grid-body');

// Auth Switch
onAuthStateChanged(auth, (user) => {
    document.getElementById('login-overlay').style.display = user ? 'none' : 'flex';
    document.getElementById('app-container').style.display = user ? 'block' : 'none';
});

// Login/Logout
document.getElementById('login-btn').onclick = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
};
document.getElementById('logout-btn').onclick = () => signOut(auth);

// Modal Controls
document.getElementById('open-logbook-btn').onclick = () => {
    renderGrid();
    logModal.style.display = 'block';
};
document.querySelector('.close-logbook').onclick = () => logModal.style.display = 'none';

// Map
const map = L.map('map').setView([31.9686, -99.9018], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const getLocalLogs = () => JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];

// Delete Logic
window.deleteEntry = async (id) => {
    if (!confirm("Delete this entry?")) return;
    let logs = getLocalLogs().filter(l => l.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    renderGrid();
    
    if (navigator.onLine) {
        const q = query(collection(db, "logs"), where("id", "==", id));
        const snap = await getDocs(q);
        snap.forEach(d => deleteDoc(d.ref));
    }
};

// Inline Edit Logic
window.editEntry = async (id, field, value) => {
    let logs = getLocalLogs();
    const idx = logs.findIndex(l => l.id === id);
    if (idx !== -1) {
        logs[idx][field] = value;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
        
        if (navigator.onLine) {
            const q = query(collection(db, "logs"), where("id", "==", id));
            const snap = await getDocs(q);
            snap.forEach(d => updateDoc(d.ref, { [field]: value }));
        }
    }
};

function renderGrid() {
    const logs = getLocalLogs();
    logGridBody.innerHTML = logs.map(log => `
        <tr>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td contenteditable="true" onblur="editEntry(${log.id}, 'callsign', this.innerText)">${log.callsign}</td>
            <td contenteditable="true" onblur="editEntry(${log.id}, 'frequency', this.innerText)">${log.frequency}</td>
            <td contenteditable="true" onblur="editEntry(${log.id}, 'mode', this.innerText)">${log.mode}</td>
            <td contenteditable="true" onblur="editEntry(${log.id}, 'notes', this.innerText)">${log.notes}</td>
            <td><button class="del-btn" onclick="deleteEntry(${log.id})">Delete</button></td>
        </tr>
    `).join('');
}

// Form Submit
document.getElementById('log-form').onsubmit = async (e) => {
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
    
    let logs = getLocalLogs();
    logs.unshift(entry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    
    if (navigator.onLine) {
        await addDoc(collection(db, "logs"), { ...entry, createdAt: serverTimestamp(), uid: auth.currentUser.uid });
    }
    e.target.reset();
    alert("Saved!");
};

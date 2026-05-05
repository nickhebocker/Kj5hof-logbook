// Firebase Configuration (Placeholder)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    projectId: "radiolog-id",
    storageBucket: "radiolog.appspot.com",
    messagingSenderId: "ID",
    appId: "APP_ID"
};

// State Management
let currentUser = null;
let isGuest = localStorage.getItem('isGuest') === 'true';

// HamDB Lookup
async function lookupCallsign(call) {
    if (!call) return;
    try {
        const response = await fetch(`https://api.hamdb.org/${call}/json/radiolog-app`);
        const data = await response.json();
        if (data.hamdb.messages.status === "OK") {
            const info = data.hamdb.callsign;
            document.getElementById('remote-info').innerText = `${info.name}, ${info.country}`;
            updateMap(info.lat, info.poly);
        }
    } catch (err) { console.error("HamDB lookup failed"); }
}

// Coordinate Conversion (Maidenhead to Lat/Long)
function gridToCoords(grid) {
    grid = grid.toUpperCase();
    let lon = (grid.charCodeAt(0) - 65) * 20 - 180 + (grid.charCodeAt(2) - 48) * 2;
    let lat = (grid.charCodeAt(1) - 65) * 10 - 90 + (grid.charCodeAt(3) - 48) * 1;
    return [lat + 0.5, lon + 1];
}

// Persistence Routing
function saveQSO(qsoData) {
    if (currentUser) {
        // db.collection('qsos').add(qsoData);
        console.log("Saving to Firestore");
    } else {
        const logs = JSON.parse(localStorage.getItem('localLogs') || '[]');
        logs.push(qsoData);
        localStorage.setItem('localLogs', JSON.stringify(logs));
    }
}

// UI Event Listeners
document.getElementById('target-call')?.addEventListener('blur', (e) => {
    lookupCallsign(e.target.value);
});

// Sync Utility
function syncLocalToCloud() {
    const local = JSON.parse(localStorage.getItem('localLogs') || '[]');
    if (local.length > 0 && currentUser) {
        // Migration logic...
        localStorage.removeItem('localLogs');
    }
}

// Map Initialization (Placeholder)
function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;
    const map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

document.addEventListener('DOMContentLoaded', initMap);

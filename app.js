import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://l7snUYdqjCF89ufpXxhI.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_l7snUYdqjCF89ufpXxhI7A_eVjZTm5G'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let map, userMarker, targetMarker, pathLine;

// --- AUTHENTICATION ENGINE ---
supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    const display = document.getElementById('user-display');
    if (display) {
        display.innerText = currentUser ? `Logged in: ${currentUser.email}` : "Guest Mode";
    }
    
    if (event === 'SIGNED_IN') {
        syncLocalToCloud();
    }
});

// --- NAVIGATION & UI HELPERS ---
const updateClock = () => {
    const clock = document.getElementById('utc-clock');
    if (clock) clock.innerText = new Date().toISOString().split('T')[1].split('.')[0] + " UTC";
};
setInterval(updateClock, 1000);

// --- HAMDB & MAPPING LOGIC ---
async function lookupCallsign(call) {
    if (!call || call.length < 3) return;
    try {
        const response = await fetch(`https://api.hamdb.org/${call}/json/radiolog-app`);
        const data = await response.json();
        if (data.hamdb.messages.status === "OK") {
            const info = data.hamdb.callsign;
            document.getElementById('remote-info').innerHTML = `<strong>${info.name}</strong><br>${info.country}`;
            
            if (info.lat && info.poly) {
                updateMapPath([parseFloat(info.lat), parseFloat(info.poly)]);
            }
        }
    } catch (err) { console.error("HamDB lookup failed", err); }
}

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Get user location for the "Home" pin
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const homeCoords = [pos.coords.latitude, pos.coords.longitude];
            userMarker = L.marker(homeCoords).addTo(map).bindPopup("Your Station").openPopup();
            map.setView(homeCoords, 4);
        });
    }
}

function updateMapPath(targetCoords) {
    if (!map) return;
    if (targetMarker) map.removeLayer(targetMarker);
    if (pathLine) map.removeLayer(pathLine);

    targetMarker = L.marker(targetCoords).addTo(map);
    
    if (userMarker) {
        const start = userMarker.getLatLng();
        pathLine = L.polyline([start, targetCoords], {color: '#ffb300', weight: 3, dashArray: '5, 10'}).addTo(map);
        map.fitBounds(pathLine.getBounds(), {padding: [50, 50]});
    }
}

// --- DATA PERSISTENCE ---
async function saveQSO(qsoData) {
    if (currentUser) {
        const { error } = await supabase
            .from('qsos')
            .insert([{ ...qsoData, user_id: currentUser.id }]);
        if (error) alert("Cloud Save Error: " + error.message);
    } else {
        const logs = JSON.parse(localStorage.getItem('localLogs') || '[]');
        logs.push(qsoData);
        localStorage.setItem('localLogs', JSON.stringify(logs));
        alert("Saved to Local Storage (Guest)");
    }
    renderTable();
}

async function syncLocalToCloud() {
    const local = JSON.parse(localStorage.getItem('localLogs') || '[]');
    if (local.length > 0 && currentUser) {
        const preparedLogs = local.map(log => ({ ...log, user_id: currentUser.id }));
        const { error } = await supabase.from('qsos').insert(preparedLogs);
        if (!error) {
            localStorage.removeItem('localLogs');
            console.log("Local logs synced to cloud.");
            renderTable();
        }
    }
}

async function renderTable() {
    const tbody = document.getElementById('qso-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    let allLogs = [];
    
    // Fetch Cloud Logs
    if (currentUser) {
        const { data, error } = await supabase
            .from('qsos')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error) allLogs = [...data];
    }

    // Append Local Logs
    const local = JSON.parse(localStorage.getItem('localLogs') || '[]');
    allLogs = [...allLogs, ...local];

    allLogs.forEach(qso => {
        const row = `<tr>
            <td>${new Date(qso.created_at).toLocaleString()}</td>
            <td class="mono">${qso.callsign}</td>
            <td>${qso.freq} MHz</td>
            <td>${qso.mode}</td>
            <td>${qso.rst_s}/${qso.rst_r}</td>
            <td><button onclick="deleteQSO('${qso.id || qso.created_at}')">🗑️</button></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    renderTable();

    document.getElementById('log-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const qsoData = {
            callsign: document.getElementById('target-call').value.toUpperCase(),
            rst_s: document.getElementById('rst-s').value,
            rst_r: document.getElementById('rst-r').value,
            freq: document.getElementById('freq').value,
            mode: document.getElementById('mode').value,
            notes: document.getElementById('notes').value,
            created_at: new Date().toISOString()
        };
        await saveQSO(qsoData);
        e.target.reset();
    });

    document.getElementById('target-call')?.addEventListener('blur', (e) => {
        lookupCallsign(e.target.value);
    });

    // Handle Login Tab Switches for index.html
    window.switchTab = (type) => {
        const callGroup = document.getElementById('callsign-group');
        const loginTab = document.getElementById('tab-login');
        const signupTab = document.getElementById('tab-signup');
        
        if (type === 'signup') {
            callGroup.style.display = 'block';
            signupTab.classList.add('active');
            loginTab.classList.remove('active');
        } else {
            callGroup.style.display = 'none';
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
        }
    };
});

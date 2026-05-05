import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Configuration
const SUPABASE_URL = 'https://l7snUYdqjCF89ufpXxhI.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l7snUYdqjCF89ufpXxhI7A_eVjZTm5G';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let map, userMarker, targetMarker, pathLine;

// Clock Logic
setInterval(() => {
    const clock = document.getElementById('utc-clock');
    if (clock) {
        clock.innerText = new Date().toISOString().split('T')[1].split('.')[0] + " UTC";
    }
}, 1000);

// Initialize Map
function initMap() {
    // Default view: Center of the world
    map = L.map('map').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Try to get user's location for the "Shack" marker
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const coords = [pos.coords.latitude, pos.coords.longitude];
            userMarker = L.marker(coords).addTo(map).bindPopup("Your Shack").openPopup();
            map.setView(coords, 4);
        }, () => {
            console.log("Geolocation denied or unavailable.");
        });
    }
}

// HamDB Lookup
async function lookup(call) {
    if (!call || call.length < 3) return;
    
    const infoDiv = document.getElementById('remote-info');
    infoDiv.innerText = "Looking up...";

    try {
        const res = await fetch(`https://api.hamdb.org/${call}/json/radiolog`);
        const data = await res.json();
        
        if (data.hamdb && data.hamdb.messages.status === "OK") {
            const info = data.hamdb.callsign;
            infoDiv.innerHTML = `<strong>${info.name}</strong><br>${info.addr2 || ''} ${info.country}`;
            
            // Note: HamDB uses 'lat' and 'poly' for coordinates in some API versions
            const lat = parseFloat(info.lat);
            const lng = parseFloat(info.poly); 

            if (!isNaN(lat) && !isNaN(lng)) {
                const targetCoords = [lat, lng];
                
                if (targetMarker) map.removeLayer(targetMarker);
                if (pathLine) map.removeLayer(pathLine);
                
                targetMarker = L.marker(targetCoords).addTo(map).bindPopup(info.callsign).openPopup();
                
                if (userMarker) {
                    pathLine = L.polyline([userMarker.getLatLng(), targetCoords], {
                        color: '#ffb300',
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '5, 10'
                    }).addTo(map);
                    map.fitBounds(pathLine.getBounds(), { padding: [50, 50] });
                } else {
                    map.setView(targetCoords, 5);
                }
            }
        } else {
            infoDiv.innerText = "Callsign not found.";
        }
    } catch (e) { 
        console.error("Lookup error:", e);
        infoDiv.innerText = "Lookup failed.";
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initMap();

    // Session Management
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user;
    
    const userDisplay = document.getElementById('user-display');
    if (currentUser) {
        userDisplay.innerText = `Logged in as: ${currentUser.email}`;
    } else {
        userDisplay.innerText = "Guest Mode - Saving to local storage";
    }

    // Event Listeners
    document.getElementById('target-call').addEventListener('blur', (e) => {
        lookup(e.target.value.toUpperCase());
    });

    document.getElementById('log-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const qso = {
            callsign: document.getElementById('target-call').value.toUpperCase(),
            rst_s: document.getElementById('rst-s').value,
            rst_r: document.getElementById('rst-r').value,
            freq: document.getElementById('freq').value,
            mode: document.getElementById('mode').value,
            notes: document.getElementById('notes').value,
            created_at: new Date().toISOString()
        };

        try {
            if (currentUser) {
                const { error } = await supabase
                    .from('qsos')
                    .insert([{ ...qso, user_id: currentUser.id }]);
                if (error) throw error;
            } else {
                const logs = JSON.parse(localStorage.getItem('localLogs') || '[]');
                logs.push(qso);
                localStorage.setItem('localLogs', JSON.stringify(logs));
            }
            
            alert("QSO Logged Successfully!");
            e.target.reset();
            document.getElementById('remote-info').innerText = "Enter callsign to see location...";
            if (targetMarker) map.removeLayer(targetMarker);
            if (pathLine) map.removeLayer(pathLine);
        } catch (err) {
            alert("Error logging QSO: " + err.message);
        }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
});

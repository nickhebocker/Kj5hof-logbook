import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://l7snUYdqjCF89ufpXxhI.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l7snUYdqjCF89ufpXxhI7A_eVjZTm5G';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let map, userMarker, targetMarker, pathLine;

// Clock
setInterval(() => {
    const clock = document.getElementById('utc-clock');
    if (clock) clock.innerText = new Date().toISOString().split('T')[1].split('.')[0] + " UTC";
}, 1000);

// Initialize Map
function initMap() {
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const coords = [pos.coords.latitude, pos.coords.longitude];
            userMarker = L.marker(coords).addTo(map).bindPopup("Your Shack");
            map.setView(coords, 4);
        });
    }
}

// HamDB Lookup
async function lookup(call) {
    if (call.length < 3) return;
    try {
        const res = await fetch(`https://api.hamdb.org/${call}/json/radiolog`);
        const data = await res.json();
        if (data.hamdb.messages.status === "OK") {
            const info = data.hamdb.callsign;
            document.getElementById('remote-info').innerHTML = `${info.name}<br>${info.country}`;
            const targetCoords = [parseFloat(info.lat), parseFloat(info.poly)];
            
            if (targetMarker) map.removeLayer(targetMarker);
            if (pathLine) map.removeLayer(pathLine);
            
            targetMarker = L.marker(targetCoords).addTo(map);
            if (userMarker) {
                pathLine = L.polyline([userMarker.getLatLng(), targetCoords], {color: '#ffb300'}).addTo(map);
                map.fitBounds(pathLine.getBounds());
            }
        }
    } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user;
    document.getElementById('user-display').innerText = currentUser ? currentUser.email : "Guest Mode";

    document.getElementById('target-call').addEventListener('blur', (e) => lookup(e.target.value));

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

        if (currentUser) {
            await supabase.from('qsos').insert([{ ...qso, user_id: currentUser.id }]);
        } else {
            const logs = JSON.parse(localStorage.getItem('localLogs') || '[]');
            logs.push(qso);
            localStorage.setItem('localLogs', JSON.stringify(logs));
        }
        alert("Logged!");
        e.target.reset();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        supabase.auth.signOut();
        window.location.href = 'index.html';
    });
});

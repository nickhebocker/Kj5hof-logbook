// ---------------- NAVIGATION ----------------
function toggleView(showLog) {
  const main = document.getElementById("main-view");
  const log = document.getElementById("logbook-view");
  if (showLog) {
    main.style.display = "none";
    log.style.display = "block";
  } else {
    main.style.display = "block";
    log.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("showLogBtn").onclick = () => toggleView(true);
  document.getElementById("backToMap").onclick = () => toggleView(false);
  document.getElementById("clearBtn").onclick = resetForm;
  document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");
});

// ---------------- MAP & DB SETUP ----------------
const map = L.map("map").setView([30, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(map);
const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let db, qsos = [], selectedId = null, lookupAttempted = false;

const dbReq = indexedDB.open("KJ5HOF_Logbook", 2);
dbReq.onupgradeneeded = e => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("qsos")) db.createObjectStore("qsos", { keyPath: "id", autoIncrement: true });
};
dbReq.onsuccess = e => { db = e.target.result; loadAll(); };

function loadAll() {
  if (!db) return;
  const tx = db.transaction("qsos", "readonly");
  tx.objectStore("qsos").getAll().onsuccess = e => {
    qsos = e.target.result;
    render();
  };
}

function render() {
  cluster.clearLayers();
  const tableBody = document.querySelector("#qsoTable tbody");
  if (!tableBody) return;
  tableBody.innerHTML = "";
  qsos.forEach(q => {
    if (q.lat && q.lon) {
      const m = L.circleMarker([q.lat, q.lon], { radius: 10, color: "red" });
      m.bindPopup(`<b>${q.call}</b><br>${q.band} ${q.mode}`);
      m.on("click", () => selectQSO(q));
      cluster.addLayer(m);
    }
    const row = tableBody.insertRow();
    row.innerHTML = `<td>${q.call}</td><td>${q.band}</td><td>${q.mode}</td><td>${q.grid || ''}</td>`;
    row.onclick = () => { selectQSO(q); toggleView(false); };
  });
}

// ---------------- 404 / TIMEOUT ERROR FIX ----------------
document.getElementById("saveQSO").onclick = async function() {
  const btn = this;
  const call = document.getElementById("call").value.trim().toUpperCase();
  const latF = document.getElementById("lat"), lonF = document.getElementById("lon"), gridF = document.getElementById("grid");

  if (!call) return alert("Enter Callsign");

  // Step 1: Lookup (Handles 404, Timeout, and Blocks)
  if (!latF.value && !lookupAttempted && !selectedId) {
    btn.textContent = "Searching...";
    btn.disabled = true;

    try {
      // Use AllOrigins with a cache-buster to prevent immediate 404 loops
      const target = `https://callook.info/${call}/json`;
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}&_=${Date.now()}`;
      
      const r = await fetch(proxy);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      
      const j = await r.json(); 
      const data = JSON.parse(j.contents);

      if (data && data.status === "VALID") {
        latF.value = data.location.latitude || "";
        lonF.value = data.location.longitude || "";
        gridF.value = data.location.gridsquare || "";
        btn.textContent = "Confirm & Save";
        btn.style.background = "#28a745";
      } else {
        // This handles when the site is found but your specific call is missing
        alert("Not Found: This callsign isn't in the FCC database yet.");
        btn.textContent = "Save Manual";
        btn.style.background = "#fd7e14";
      }
    } catch (e) { 
      // This handles 404, Timeouts (408), and "Failed to Fetch"
      alert("Search Interrupted!\nReason: " + e.message + "\n\nYou can still save the QSO manually.");
      btn.textContent = "Save Anyway";
      btn.style.background = "#6c757d";
    }
    
    lookupAttempted = true; 
    btn.disabled = false;
    return;
  }

  // Step 2: Save to DB
  const qso = {
    call, lat: parseFloat(latF.value) || null, lon: parseFloat(lonF.value) || null,
    band: document.getElementById("band").value.trim(), mode: document.getElementById("mode").value.trim(), grid: gridF.value.trim()
  };
  if (selectedId) qso.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").put(qso);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- HELPERS ----------------
function resetForm() {
  selectedId = null; lookupAttempted = false;
  document.querySelectorAll("#editor input").forEach(i => i.value = "");
  const b = document.getElementById("saveQSO");
  b.textContent = "Save QSO"; b.style.background = "";
  document.getElementById("deleteQSO").style.display = "none";
}

function selectQSO(q) {
  selectedId = q.id; lookupAttempted = true;
  document.getElementById("call").value = q.call;
  document.getElementById("lat").value = q.lat || "";
  document.getElementById("lon").value = q.lon || "";
  document.getElementById("band").value = q.band || "";
  document.getElementById("mode").value = q.mode || "";
  document.getElementById("grid").value = q.grid || "";
  document.getElementById("saveQSO").textContent = "Update Entry";
  document.getElementById("deleteQSO").style.display = "block";
}

document.getElementById("deleteQSO").onclick = () => {
  if (!selectedId || !confirm("Delete?")) return;
  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- EXPORTS ----------------
document.getElementById("exportADIF").onclick = () => {
  let out = "ADIF Export\n<EOH>\n";
  qsos.forEach(q => { out += `<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`; });
  const blob = new Blob([out], {type: "text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "log.adi"; a.click();
};

document.getElementById("backupBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(qsos)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "backup.json"; a.click();
};

document.getElementById("restoreBtn").onclick = () => document.getElementById("restoreInput").click();
document.getElementById("restoreInput").onchange = e => {
  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    const tx = db.transaction("qsos", "readwrite");
    data.forEach(q => { delete q.id; tx.objectStore("qsos").add(q); });
    tx.oncomplete = loadAll;
  };
  reader.readAsText(e.target.files[0]);
};

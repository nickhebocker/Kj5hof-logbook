// ---------------- 1. NAVIGATION & INITIALIZATION ----------------
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

// ---------------- 2. MAP SETUP ----------------
const map = L.map("map").setView([30, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(map);
const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let db, qsos = [], selectedId = null, lookupAttempted = false;

// ---------------- 3. DATABASE ----------------
const dbReq = indexedDB.open("KJ5HOF_Log", 2);
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

// ---------------- 4. SAVE & LOOKUP (WITH ERROR REPORTING) ----------------
document.getElementById("saveQSO").onclick = async function() {
  const call = document.getElementById("call").value.trim().toUpperCase();
  const latF = document.getElementById("lat"), lonF = document.getElementById("lon"), gridF = document.getElementById("grid");

  if (!call) return alert("Enter Callsign");

  if (!latF.value && !lookupAttempted && !selectedId) {
    this.textContent = "Searching...";
    try {
      const proxy = "https://api.allorigins.win/get?url=";
      const target = encodeURIComponent(`https://hamdb.org/api/${call}/json/KJ5HOF`);
      
      const r = await fetch(proxy + target);
      if (!r.ok) throw new Error(`HTTP Status ${r.status}`);
      
      const j = await r.json(); 
      if (!j.contents) throw new Error("Proxy returned empty content.");
      
      const d = JSON.parse(j.contents);

      if (d.hamdb && d.hamdb.callsign) {
        const i = d.hamdb.callsign;
        latF.value = i.lat || ""; 
        lonF.value = i.lng || ""; 
        gridF.value = i.grid || "";
        this.textContent = "Confirm & Save";
        this.style.background = "#28a745";
      } else {
        alert("Not Found: Callsign not in HamDB (US/CA/AU only).");
        this.textContent = "Manual Save";
        this.style.background = "#fd7e14";
      }
    } catch (e) { 
      // --- POPUP ERROR LOGGING ---
      alert("Lookup Failed!\nReason: " + e.message + "\n\nNote: If using GitHub Pages, this is often a CORS or Proxy delay. You can still enter details manually.");
      this.textContent = "Save Anyway"; 
    }
    lookupAttempted = true; 
    return;
  }

  const qso = {
    call, lat: parseFloat(latF.value) || null, lon: parseFloat(lonF.value) || null,
    band: document.getElementById("band").value.trim(), mode: document.getElementById("mode").value.trim(), grid: gridF.value.trim()
  };
  if (selectedId) qso.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").put(qso);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- 5. HELPERS ----------------
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

// ---------------- 6. IO ----------------
document.getElementById("exportADIF").onclick = () => {
  let out = "ADIF Export\n<EOH>\n";
  qsos.forEach(q => { out += `<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`; });
  download(out, "log.adi", "text/plain");
};
document.getElementById("backupBtn").onclick = () => download(JSON.stringify(qsos, null, 2), "log_backup.json", "application/json");
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
function download(c, f, t) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([c], { type: t }));
  a.download = f; a.click();
}

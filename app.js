// ---------------- SETUP ----------------
const map = L.map("map").setView([30, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let db;
let qsos = [];
let selectedId = null;
let lookupReady = false; 

// ---------------- DATABASE ----------------
const dbReq = indexedDB.open("KJ5HOF_Log", 2); // Version 2

dbReq.onupgradeneeded = e => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("qsos")) {
    db.createObjectStore("qsos", { keyPath: "id", autoIncrement: true });
  }
};

dbReq.onsuccess = e => {
  db = e.target.result;
  loadAll();
};

// ---------------- DATA HANDLING ----------------
function loadAll() {
  const tx = db.transaction("qsos", "readonly");
  const store = tx.objectStore("qsos");
  const req = store.getAll();

  req.onsuccess = () => {
    qsos = req.result;
    render();
  };
}

function render() {
  cluster.clearLayers();
  const bF = document.getElementById("bandFilter").value;
  const mF = document.getElementById("modeFilter").value;

  const filtered = qsos.filter(q => 
    (!bF || q.band === bF) && (!mF || q.mode === mF)
  );

  filtered.forEach(q => {
    if (!q.lat || !q.lon) return;
    const marker = L.circleMarker([q.lat, q.lon], {
      radius: 10,
      color: q.band === "20m" ? "red" : q.band === "40m" ? "blue" : "green",
      fillOpacity: 0.7
    });
    marker.bindPopup(`<b>${q.call}</b><br>${q.band} ${q.mode}<br>${q.grid || ''}`);
    marker.on("click", () => selectQSO(q));
    cluster.addLayer(marker);
  });

  updateFilters();
  document.getElementById("stats").textContent = `QSOs: ${filtered.length}`;
}

// ---------------- MOBILE LOOKUP + SAVE ----------------
document.getElementById("saveQSO").onclick = async function() {
  const call = document.getElementById("call").value.trim().toUpperCase();
  const latField = document.getElementById("lat");
  const lonField = document.getElementById("lon");

  if (!call) return alert("Enter Callsign");

  // Step 1: If Lat/Lon are empty, do the lookup first
  if (!latField.value && !lookupReady && !selectedId) {
    this.textContent = "Searching...";
    this.disabled = true;

    try {
      const proxy = "https://api.allorigins.win/get?url=";
      const target = encodeURIComponent(`https://hamdb.org/api/${call}/json/KJ5HOF`);
      const resp = await fetch(proxy + target);
      const wrapper = await resp.json();
      const data = JSON.parse(wrapper.contents);

      if (data.hamdb && data.hamdb.callsign) {
        const info = data.hamdb.callsign;
        latField.value = info.lat || "";
        lonField.value = info.lng || "";
        document.getElementById("grid").value = info.grid || "";
        
        this.textContent = "Confirm & Save";
        this.style.background = "#fd7e14"; // Change color to indicate step 2
        lookupReady = true;
      } else {
        this.textContent = "Not Found - Save Anyway?";
        lookupReady = true;
      }
    } catch (e) {
      this.textContent = "Error - Save Anyway?";
      lookupReady = true;
    }
    this.disabled = false;
    return; // Stop here for user to see result
  }

  // Step 2: Actually Save
  const qso = {
    call: call,
    lat: parseFloat(latField.value) || null,
    lon: parseFloat(lonField.value) || null,
    band: document.getElementById("band").value.trim(),
    mode: document.getElementById("mode").value.trim(),
    grid: document.getElementById("grid").value.trim()
  };

  if (selectedId) qso.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").put(qso);
  
  tx.oncomplete = () => {
    resetForm();
    loadAll();
  };
};

function resetForm() {
  selectedId = null;
  lookupReady = false;
  document.querySelectorAll("#editor input").forEach(i => i.value = "");
  const btn = document.getElementById("saveQSO");
  btn.textContent = "Save QSO";
  btn.style.background = "";
  btn.disabled = false;
  document.getElementById("deleteQSO").style.display = "none";
}

document.getElementById("clearBtn").onclick = resetForm;

function selectQSO(q) {
  selectedId = q.id;
  lookupReady = true; // Disable auto-lookup when editing existing
  document.getElementById("call").value = q.call;
  document.getElementById("lat").value = q.lat || "";
  document.getElementById("lon").value = q.lon || "";
  document.getElementById("band").value = q.band || "";
  document.getElementById("mode").value = q.mode || "";
  document.getElementById("grid").value = q.grid || "";
  
  const btn = document.getElementById("saveQSO");
  btn.textContent = "Update QSO";
  btn.style.background = "#007bff";
  document.getElementById("deleteQSO").style.display = "inline-block";
}

document.getElementById("deleteQSO").onclick = () => {
  if (!selectedId) return;
  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- UTILS ----------------
function updateFilters() {
  const bSel = document.getElementById("bandFilter");
  const mSel = document.getElementById("modeFilter");
  if (bSel.options.length > 1) return; // Only populate once

  const bands = [...new Set(qsos.map(q => q.band))].filter(x => x).sort();
  const modes = [...new Set(qsos.map(q => q.mode))].filter(x => x).sort();

  bands.forEach(b => bSel.add(new Option(b, b)));
  modes.forEach(m => mSel.add(new Option(m, m)));
}

document.getElementById("bandFilter").onchange = render;
document.getElementById("modeFilter").onchange = render;

document.getElementById("zoomFiltered").onclick = () => {
  if (cluster.getLayers().length) map.fitBounds(cluster.getBounds());
};

document.getElementById("exportADIF").onclick = () => {
  let out = "ADIF Export\n<EOH>\n";
  qsos.forEach(q => {
    out += `<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`;
  });
  const blob = new Blob([out], {type: "text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "log.adi";
  a.click();
};

document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");

document.getElementById("backupBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(qsos)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "log_backup.json";
    a.click();
};

document.getElementById("restoreInput").onchange = e => {
    const reader = new FileReader();
    reader.onload = () => {
        const data = JSON.parse(reader.result);
        const tx = db.transaction("qsos", "readwrite");
        const store = tx.objectStore("qsos");
        data.forEach(q => { delete q.id; store.add(q); });
        tx.oncomplete = loadAll;
    };
    reader.readAsText(e.target.files[0]);
};

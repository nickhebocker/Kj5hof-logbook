// ---------------- MAP SETUP ----------------
const map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const cluster = L.markerClusterGroup();
map.addLayer(cluster);

// ---------------- STATE ----------------
let db;
let qsos = [];
let selectedId = null;

// ---------------- INDEXEDDB SETUP ----------------
const dbReq = indexedDB.open("logbook_db", 1);

dbReq.onupgradeneeded = e => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains("qsos")) {
    db.createObjectStore("qsos", { keyPath: "id", autoIncrement: true });
  }
};

dbReq.onsuccess = e => {
  db = e.target.result;
  loadAll();
};

// ---------------- CALLSIGN LOOKUP ----------------
document.getElementById("call").onblur = async (e) => {
  const callsign = e.target.value.trim().toUpperCase();
  // Only lookup if we aren't currently editing an existing record
  if (callsign.length < 3 || selectedId) return; 

  const proxy = "https://api.allorigins.win/get?url=";
  const target = encodeURIComponent(`https://hamdb.org/api/${callsign}/json/KJ5HOF-App`);

  try {
    const resp = await fetch(proxy + target);
    const wrapper = await resp.json();
    const data = JSON.parse(wrapper.contents);

    if (data.hamdb && data.hamdb.callsign) {
      const info = data.hamdb.callsign;
      if (info.lat) document.getElementById("lat").value = info.lat;
      if (info.lng) document.getElementById("lon").value = info.lng;
      if (info.grid) document.getElementById("grid").value = info.grid;
    }
  } catch (err) { console.warn("Lookup failed."); }
};

// ---------------- LOAD & RENDER ----------------
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
  // 1. Clear the map completely before re-drawing
  cluster.clearLayers();

  const bFilter = document.getElementById("bandFilter").value;
  const mFilter = document.getElementById("modeFilter").value;

  const filtered = qsos.filter(q => 
    (!bFilter || q.band === bFilter) && (!mFilter || q.mode === mFilter)
  );

  filtered.forEach(q => {
    if (!q.lat || !q.lon) return;
    const marker = L.circleMarker([q.lat, q.lon], {
      radius: 8,
      color: q.band === "20m" ? "red" : q.band === "40m" ? "blue" : "green",
      fillOpacity: 0.8
    });
    marker.bindPopup(`<b>${q.call}</b><br>${q.band} | ${q.mode}`);
    marker.on("click", () => selectQSO(q));
    cluster.addLayer(marker);
  });

  updateFilterOptions();
  document.getElementById("stats").textContent = `Total: ${qsos.length} | Shown: ${filtered.length}`;
}

// ---------------- UI HELPERS ----------------
function clearEditor() {
  selectedId = null;
  document.getElementById("call").value = "";
  document.getElementById("lat").value = "";
  document.getElementById("lon").value = "";
  document.getElementById("grid").value = "";
  document.getElementById("band").value = "";
  document.getElementById("mode").value = "";
  document.getElementById("saveQSO").textContent = "Save QSO";
  document.getElementById("saveQSO").disabled = false;
}

function selectQSO(q) {
  selectedId = q.id;
  document.getElementById("call").value = q.call || "";
  document.getElementById("lat").value = q.lat || "";
  document.getElementById("lon").value = q.lon || "";
  document.getElementById("band").value = q.band || "";
  document.getElementById("mode").value = q.mode || "";
  document.getElementById("grid").value = q.grid || "";
  document.getElementById("saveQSO").textContent = "Update QSO";
}

// ---------------- ACTIONS ----------------
document.getElementById("saveQSO").onclick = function() {
  const btn = this;
  const callVal = document.getElementById("call").value.trim();
  
  if (!callVal) {
    alert("Please enter a callsign.");
    return;
  }

  // Prevent double-clicks
  btn.disabled = true;
  btn.textContent = "Saving...";

  const q = {
    call: callVal.toUpperCase(),
    lat: parseFloat(document.getElementById("lat").value) || null,
    lon: parseFloat(document.getElementById("lon").value) || null,
    band: document.getElementById("band").value.trim(),
    mode: document.getElementById("mode").value.trim(),
    grid: document.getElementById("grid").value.trim()
  };

  const tx = db.transaction("qsos", "readwrite");
  const store = tx.objectStore("qsos");
  
  if (selectedId) q.id = selectedId;
  
  store.put(q);

  tx.oncomplete = () => {
    console.log("Save complete");
    clearEditor(); // Reset the form and ID
    loadAll();     // Refresh data and Map
  };

  tx.onerror = () => {
    alert("Error saving to database.");
    btn.disabled = false;
    btn.textContent = "Save QSO";
  };
};

document.getElementById("deleteQSO").onclick = () => {
  if (!selectedId) return;
  if (!confirm("Delete this QSO?")) return;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => {
    clearEditor();
    loadAll();
  };
};

// Filter logic
function updateFilterOptions() {
  const bSel = document.getElementById("bandFilter");
  const mSel = document.getElementById("modeFilter");
  const curB = bSel.value;
  const curM = mSel.value;

  const bands = [...new Set(qsos.map(q => q.band))].filter(x => x).sort();
  const modes = [...new Set(qsos.map(q => q.mode))].filter(x => x).sort();

  bSel.innerHTML = '<option value="">All Bands</option>' + 
    bands.map(b => `<option value="${b}">${b}</option>`).join("");
  mSel.innerHTML = '<option value="">All Modes</option>' + 
    modes.map(m => `<option value="${m}">${m}</option>`).join("");

  bSel.value = curB;
  mSel.value = curM;
}

document.getElementById("bandFilter").onchange = render;
document.getElementById("modeFilter").onchange = render;

// Zoom button
document.getElementById("zoomFiltered").onclick = () => {
  if (cluster.getLayers().length > 0) {
    map.fitBounds(cluster.getBounds(), { padding: [20, 20] });
  }
};

// Import/Export and Theme (Same as before)
document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");

document.getElementById("exportADIF").onclick = () => {
  let adif = "Generated by KJ5HOF\n<EOH>\n";
  qsos.forEach(q => {
    adif += `<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`;
  });
  download(adif, "log.adi");
};

function download(text, name) {
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

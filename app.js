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

// ---------------- CALLSIGN LOOKUP (HamDB) ----------------
document.getElementById("call").onblur = async (e) => {
  const callsign = e.target.value.trim().toUpperCase();
  if (callsign.length < 3 || selectedId) return; // Don't lookup if editing existing

  const proxy = "https://api.allorigins.win/get?url=";
  const target = encodeURIComponent(`https://hamdb.org/api/${callsign}/json/KJ5HOF-App`);

  try {
    const resp = await fetch(proxy + target);
    const wrapper = await resp.json();
    const data = JSON.parse(wrapper.contents);

    if (data.hamdb && data.hamdb.callsign) {
      const info = data.hamdb.callsign;
      if (info.lat && !document.getElementById("lat").value) document.getElementById("lat").value = info.lat;
      if (info.lng && !document.getElementById("lon").value) document.getElementById("lon").value = info.lng;
      if (info.grid && !document.getElementById("grid").value) document.getElementById("grid").value = info.grid;
    }
  } catch (err) {
    console.warn("Lookup unavailable.");
  }
};

// ---------------- CORE LOGIC ----------------
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
    marker.bindPopup(`<b>${q.call}</b><br>${q.band} | ${q.mode}<br>${q.grid || ''}`);
    marker.on("click", () => selectQSO(q));
    cluster.addLayer(marker);
  });

  updateFilterOptions();
  document.getElementById("stats").textContent = `Showing ${filtered.length} of ${qsos.length} QSOs`;
}

function updateFilterOptions() {
  const bSel = document.getElementById("bandFilter");
  const mSel = document.getElementById("modeFilter");
  
  const curB = bSel.value;
  const curM = mSel.value;

  const bands = [...new Set(qsos.map(q => q.band))].sort();
  const modes = [...new Set(qsos.map(q => q.mode))].sort();

  bSel.innerHTML = '<option value="">All Bands</option>' + 
    bands.map(b => `<option value="${b}">${b}</option>`).join("");
  mSel.innerHTML = '<option value="">All Modes</option>' + 
    modes.map(m => `<option value="${m}">${m}</option>`).join("");

  bSel.value = curB;
  mSel.value = curM;
}

// ---------------- UI ACTIONS ----------------
function selectQSO(q) {
  selectedId = q.id;
  ["call", "lat", "lon", "band", "mode", "grid"].forEach(f => {
    document.getElementById(f).value = q[f] || "";
  });
}

document.getElementById("saveQSO").onclick = () => {
  const q = {
    call: document.getElementById("call").value.trim().toUpperCase(),
    lat: parseFloat(document.getElementById("lat").value),
    lon: parseFloat(document.getElementById("lon").value),
    band: document.getElementById("band").value.trim(),
    mode: document.getElementById("mode").value.trim(),
    grid: document.getElementById("grid").value.trim()
  };

  const tx = db.transaction("qsos", "readwrite");
  const store = tx.objectStore("qsos");
  if (selectedId) q.id = selectedId;
  
  store.put(q);
  tx.oncomplete = () => {
    selectedId = null;
    document.querySelectorAll("#editor input").forEach(i => i.value = "");
    loadAll();
  };
};

document.getElementById("deleteQSO").onclick = () => {
  if (!selectedId) return;
  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => {
    selectedId = null;
    loadAll();
  };
};

document.getElementById("bandFilter").onchange = render;
document.getElementById("modeFilter").onchange = render;
document.getElementById("zoomFiltered").onclick = () => {
  if (cluster.getLayers().length > 0) map.fitBounds(cluster.getBounds());
};

// ---------------- IMPORT / EXPORT ----------------
document.getElementById("exportADIF").onclick = () => {
  let adif = "Generated by KJ5HOF Logbook\n<EOH>\n";
  qsos.forEach(q => {
    adif += `<CALL:${q.call.length}>${q.call} <BAND:${q.band.length}>${q.band} <MODE:${q.mode.length}>${q.mode} <EOR>\n`;
  });
  download(adif, "logbook.adi");
};

document.getElementById("importADIF").onchange = e => {
  const reader = new FileReader();
  reader.onload = () => {
    const tx = db.transaction("qsos", "readwrite");
    const store = tx.objectStore("qsos");
    const records = reader.result.split(/<EOR>/i);

    records.forEach(rec => {
      const call = /<CALL:\d+>([^< ]+)/i.exec(rec);
      const band = /<BAND:\d+>([^< ]+)/i.exec(rec);
      const mode = /<MODE:\d+>([^< ]+)/i.exec(rec);
      if (call) {
        store.add({
          call: call[1].toUpperCase(),
          band: band ? band[1] : "",
          mode: mode ? mode[1] : "",
          lat: null, lon: null, grid: ""
        });
      }
    });
    tx.oncomplete = loadAll;
  };
  reader.readAsText(e.target.files[0]);
};

// Simple helper functions
function download(text, name) {
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");

document.getElementById("backupBtn").onclick = () => {
  download(JSON.stringify(qsos, null, 2), "logbook_backup.json");
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

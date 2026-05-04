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
let lookupAttempted = false; 

// ---------------- DATABASE ----------------
const dbReq = indexedDB.open("KJ5HOF_Log", 2);

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
  if (!db) return;
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
    // Only map if we have coords, but keep in list
    if (q.lat && q.lon) {
      const marker = L.circleMarker([q.lat, q.lon], {
        radius: 10,
        color: q.band === "20m" ? "red" : q.band === "40m" ? "blue" : "green",
        fillOpacity: 0.7
      });
      marker.bindPopup(`<b>${q.call}</b><br>${q.band} ${q.mode}<br>${q.grid || ''}`);
      marker.on("click", () => selectQSO(q));
      cluster.addLayer(marker);
    }
  });

  updateFilters();
  document.getElementById("stats").textContent = `Logged: ${qsos.length} | Shown: ${filtered.length}`;
}

// ---------------- THE SMART SAVE BUTTON ----------------
document.getElementById("saveQSO").onclick = async function() {
  const btn = this;
  const call = document.getElementById("call").value.trim().toUpperCase();
  const latF = document.getElementById("lat");
  const lonF = document.getElementById("lon");
  const gridF = document.getElementById("grid");

  if (!call) return alert("Please enter a callsign.");

  // STEP 1: Attempt Lookup if fields are empty and we haven't tried yet
  if (!latF.value && !lookupAttempted && !selectedId) {
    btn.textContent = "Searching HamDB...";
    btn.disabled = true;

    try {
      const proxy = "https://api.allorigins.win/get?url=";
      const target = encodeURIComponent(`https://hamdb.org/api/${call}/json/KJ5HOF`);
      const resp = await fetch(proxy + target);
      const json = await resp.json();
      const data = JSON.parse(json.contents);

      if (data.hamdb && data.hamdb.callsign) {
        const info = data.hamdb.callsign;
        latF.value = info.lat || "";
        lonF.value = info.lng || "";
        gridF.value = info.grid || "";
        btn.textContent = "Verify & Save";
        btn.style.background = "#28a745"; // Success Green
      } else {
        btn.textContent = "Not Found - Save Manual?";
        btn.style.background = "#fd7e14"; // Warning Orange
      }
    } catch (e) {
      btn.textContent = "Lookup Failed - Save Manual?";
      btn.style.background = "#6c757d"; // Neutral Grey
    }
    
    lookupAttempted = true;
    btn.disabled = false;
    return; // Stop here so user can see/edit data
  }

  // STEP 2: Actual Save to Database
  btn.disabled = true;
  btn.textContent = "Saving...";

  const qso = {
    call: call,
    lat: parseFloat(latF.value) || null,
    lon: parseFloat(lonF.value) || null,
    band: document.getElementById("band").value.trim(),
    mode: document.getElementById("mode").value.trim(),
    grid: gridF.value.trim()
  };

  if (selectedId) qso.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  const store = tx.objectStore("qsos");
  store.put(qso);
  
  tx.oncomplete = () => {
    resetForm();
    loadAll(); // This refreshes the map
  };
  
  tx.onerror = () => {
    alert("Database Error!");
    btn.disabled = false;
  };
};

function resetForm() {
  selectedId = null;
  lookupAttempted = false;
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
  lookupAttempted = true; 
  document.getElementById("call").value = q.call;
  document.getElementById("lat").value = q.lat || "";
  document.getElementById("lon").value = q.lon || "";
  document.getElementById("band").value = q.band || "";
  document.getElementById("mode").value = q.mode || "";
  document.getElementById("grid").value = q.grid || "";
  
  const btn = document.getElementById("saveQSO");
  btn.textContent = "Update Entry";
  btn.style.background = "#007bff";
  document.getElementById("deleteQSO").style.display = "inline-block";
}

document.getElementById("deleteQSO").onclick = () => {
  if (!selectedId || !confirm("Delete this entry?")) return;
  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- UTILS ----------------
function updateFilters() {
  const bSel = document.getElementById("bandFilter");
  const mSel = document.getElementById("modeFilter");
  
  // Get current selections
  const valB = bSel.value;
  const valM = mSel.value;

  const bands = [...new Set(qsos.map(q => q.band))].filter(x => x).sort();
  const modes = [...new Set(qsos.map(q => q.mode))].filter(x => x).sort();

  bSel.innerHTML = '<option value="">All Bands</option>';
  mSel.innerHTML = '<option value="">All Modes</option>';
  
  bands.forEach(b => bSel.add(new Option(b, b)));
  modes.forEach(m => mSel.add(new Option(m, m)));
  
  bSel.value = valB;
  mSel.value = valM;
}

document.getElementById("bandFilter").onchange = render;
document.getElementById("modeFilter").onchange = render;

document.getElementById("zoomFiltered").onclick = () => {
  if (cluster.getLayers().length) map.fitBounds(cluster.getBounds(), {padding: [50, 50]});
};

document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");

document.getElementById("backupBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(qsos, null, 2)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `KJ5HOF_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
};

document.getElementById("restoreInput").onchange = e => {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            const tx = db.transaction("qsos", "readwrite");
            const store = tx.objectStore("qsos");
            data.forEach(q => { delete q.id; store.add(q); });
            tx.oncomplete = loadAll;
        } catch(err) { alert("Invalid Backup File"); }
    };
    reader.readAsText(e.target.files[0]);
};

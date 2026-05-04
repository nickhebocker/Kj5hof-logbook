// ---------------- MAP & DB SETUP ----------------
const map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let db;
let qsos = [];
let selectedId = null;
let lookupPerformed = false; // Tracks if we just did a lookup

const dbReq = indexedDB.open("logbook_db", 1);
dbReq.onupgradeneeded = e => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains("qsos")) {
    db.createObjectStore("qsos", { keyPath: "id", autoIncrement: true });
  }
};
dbReq.onsuccess = e => { db = e.target.result; loadAll(); };

// ---------------- CORE FUNCTIONS ----------------

function loadAll() {
  const tx = db.transaction("qsos", "readonly");
  const store = tx.objectStore("qsos");
  const req = store.getAll();
  req.onsuccess = () => { qsos = req.result; render(); };
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
      radius: 10, // Larger touch target for mobile
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

// ---------------- THE "SMART" SAVE BUTTON ----------------

document.getElementById("saveQSO").onclick = async function() {
  const btn = this;
  const callInput = document.getElementById("call");
  const latInput = document.getElementById("lat");
  const callVal = callInput.value.trim().toUpperCase();

  if (!callVal) return alert("Enter a callsign");

  // STEP 1: If Lat is empty and we haven't looked it up yet, do the lookup
  if (!latInput.value && !lookupPerformed) {
    btn.disabled = true;
    btn.textContent = "Looking up...";
    
    const proxy = "https://api.allorigins.win/get?url=";
    const target = encodeURIComponent(`https://hamdb.org/api/${callVal}/json/KJ5HOF-App`);

    try {
      const resp = await fetch(proxy + target);
      const wrapper = await resp.json();
      const data = JSON.parse(wrapper.contents);

      if (data.hamdb && data.hamdb.callsign) {
        const info = data.hamdb.callsign;
        document.getElementById("lat").value = info.lat || "";
        document.getElementById("lon").value = info.lng || "";
        document.getElementById("grid").value = info.grid || "";
        
        lookupPerformed = true;
        btn.textContent = "Verify & Save"; // Prompt user for the second tap
        btn.style.background = "#ffc107"; // Orange for "Attention"
        btn.style.color = "#000";
      } else {
        // Not found, allow manual entry/save
        btn.textContent = "Not Found - Save Anyway?";
        lookupPerformed = true;
      }
    } catch (err) {
      btn.textContent = "Lookup Failed - Save?";
      lookupPerformed = true;
    } finally {
      btn.disabled = false;
    }
    return; // Stop here so user can see data
  }

  // STEP 2: Actual Save Logic
  btn.disabled = true;
  const q = {
    call: callVal,
    lat: parseFloat(document.getElementById("lat").value) || null,
    lon: parseFloat(document.getElementById("lon").value) || null,
    band: document.getElementById("band").value.trim(),
    mode: document.getElementById("mode").value.trim(),
    grid: document.getElementById("grid").value.trim()
  };

  if (selectedId) q.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").put(q);
  tx.oncomplete = () => {
    resetForm();
    loadAll();
  };
};

function resetForm() {
  selectedId = null;
  lookupPerformed = false;
  document.querySelectorAll("#editor input").forEach(i => i.value = "");
  const btn = document.getElementById("saveQSO");
  btn.textContent = "Save QSO";
  btn.style.background = ""; // Reset color
  btn.style.color = "";
  btn.disabled = false;
}

function selectQSO(q) {
  selectedId = q.id;
  lookupPerformed = true; // Don't trigger lookup on something already saved
  document.getElementById("call").value = q.call || "";
  document.getElementById("lat").value = q.lat || "";
  document.getElementById("lon").value = q.lon || "";
  document.getElementById("band").value = q.band || "";
  document.getElementById("mode").value = q.mode || "";
  document.getElementById("grid").value = q.grid || "";
  document.getElementById("saveQSO").textContent = "Update QSO";
}

document.getElementById("deleteQSO").onclick = () => {
  if (!selectedId || !confirm("Delete?")) return;
  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// Filter handling
function updateFilterOptions() {
  const bSel = document.getElementById("bandFilter");
  const mSel = document.getElementById("modeFilter");
  const curB = bSel.value; const curM = mSel.value;
  const bands = [...new Set(qsos.map(q => q.band))].filter(x => x).sort();
  const modes = [...new Set(qsos.map(q => q.mode))].filter(x => x).sort();
  bSel.innerHTML = '<option value="">All Bands</option>' + bands.map(b => `<option value="${b}">${b}</option>`).join("");
  mSel.innerHTML = '<option value="">All Modes</option>' + modes.map(m => `<option value="${m}">${m}</option>`).join("");
  bSel.value = curB; mSel.value = curM;
}

document.getElementById("bandFilter").onchange = render;
document.getElementById("modeFilter").onchange = render;
document.getElementById("zoomFiltered").onclick = () => {
  if (cluster.getLayers().length > 0) map.fitBounds(cluster.getBounds(), { padding: [20, 20] });
};
document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");

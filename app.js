const map = L.map("map").setView([30, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(map);
const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let db, qsos = [], selectedId = null, lookupAttempted = false;

const dbReq = indexedDB.open("KJ5HOF_Log", 2);
dbReq.onupgradeneeded = e => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("qsos")) db.createObjectStore("qsos", { keyPath: "id", autoIncrement: true });
};
dbReq.onsuccess = e => { db = e.target.result; loadAll(); };

function loadAll() {
  const tx = db.transaction("qsos", "readonly");
  tx.objectStore("qsos").getAll().onsuccess = e => {
    qsos = e.target.result;
    render();
  };
}

function render() {
  cluster.clearLayers();
  const bF = document.getElementById("bandFilter").value;
  const mF = document.getElementById("modeFilter").value;

  qsos.filter(q => (!bF || q.band === bF) && (!mF || q.mode === mF)).forEach(q => {
    if (q.lat && q.lon) {
      const m = L.circleMarker([q.lat, q.lon], { radius: 10, color: "red" });
      m.bindPopup(`<b>${q.call}</b><br>${q.band} ${q.mode}`);
      m.on("click", () => selectQSO(q));
      cluster.addLayer(m);
    }
  });
  document.getElementById("stats").textContent = `QSOs: ${qsos.length}`;
}

document.getElementById("saveQSO").onclick = async function() {
  const call = document.getElementById("call").value.trim().toUpperCase();
  const latF = document.getElementById("lat"), lonF = document.getElementById("lon"), gridF = document.getElementById("grid");

  if (!call) return alert("Enter Callsign");

  if (!latF.value && !lookupAttempted && !selectedId) {
    this.textContent = "Searching...";
    try {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://hamdb.org/api/'+call+'/json/KJ5HOF')}`);
      const j = await r.json(); const d = JSON.parse(j.contents);
      if (d.hamdb?.callsign) {
        const i = d.hamdb.callsign;
        latF.value = i.lat || ""; lonF.value = i.lng || ""; gridF.value = i.grid || "";
        this.textContent = "Confirm & Save";
        this.style.background = "#28a745";
      } else {
        this.textContent = "Manual Save";
        this.style.background = "#fd7e14";
      }
    } catch (e) { this.textContent = "Save Anyway"; }
    lookupAttempted = true; return;
  }

  const qso = {
    call, lat: parseFloat(latF.value) || null, lon: parseFloat(lonF.value) || null,
    band: document.getElementById("band").value, mode: document.getElementById("mode").value, grid: gridF.value
  };
  if (selectedId) qso.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").put(qso);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

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
  document.getElementById("lat").value = q.lat;
  document.getElementById("lon").value = q.lon;
  document.getElementById("band").value = q.band;
  document.getElementById("mode").value = q.mode;
  document.getElementById("grid").value = q.grid;
  document.getElementById("saveQSO").textContent = "Update Entry";
  document.getElementById("deleteQSO").style.display = "block";
}

document.getElementById("clearBtn").onclick = resetForm;
document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");

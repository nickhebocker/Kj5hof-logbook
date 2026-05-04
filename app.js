// ---------------- SETUP ----------------
const map = L.map("map").setView([30, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(map);
const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let db, qsos = [], selectedId = null, lookupAttempted = false;

// ---------------- DATABASE ----------------
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
  const tableBody = document.querySelector("#qsoTable tbody");
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

// ---------------- NAVIGATION ----------------
function toggleView(showLog) {
  document.getElementById("main-view").style.display = showLog ? "none" : "block";
  document.getElementById("logbook-view").style.display = showLog ? "block" : "none";
}
document.getElementById("showLogBtn").onclick = () => toggleView(true);
document.getElementById("backToMap").onclick = () => toggleView(false);

// ---------------- SAVE LOGIC ----------------
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

document.getElementById("clearBtn").onclick = resetForm;
document.getElementById("deleteQSO").onclick = () => {
  if (!selectedId || !confirm("Delete?")) return;
  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- EXPORT / BACKUP ----------------
document.getElementById("exportADIF").onclick = () => {
  let out = "ADIF Export\n<EOH>\n";
  qsos.forEach(q => {
    out += `<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`;
  });
  download(out, "log.adi", "text/plain");
};

document.getElementById("backupBtn").onclick = () => {
  download(JSON.stringify(qsos, null, 2), "log_backup.json", "application/json");
};

document.getElementById("restoreBtn").onclick = () => document.getElementById("restoreInput").click();
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

function download(content, filename, type) {
  const blob = new Blob([content], { type: type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");

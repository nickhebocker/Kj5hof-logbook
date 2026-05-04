// ---------------- 1. INITIALIZATION ----------------
const map = L.map("map").setView([30, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(map);
const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let db, qsos = [], selectedId = null, lookupReady = false;

// ---------------- 2. DATABASE SETUP ----------------
const dbReq = indexedDB.open("KJ5HOF_Logbook", 2);
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

// ---------------- 3. RENDERING ----------------
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

// ---------------- 4. NAVIGATION ----------------
function toggleView(showLog) {
  document.getElementById("main-view").style.display = showLog ? "none" : "block";
  document.getElementById("logbook-view").style.display = showLog ? "block" : "none";
}

document.getElementById("showLogBtn").onclick = () => toggleView(true);
document.getElementById("backToMap").onclick = () => toggleView(false);
document.getElementById("darkToggle").onclick = () => document.body.classList.toggle("dark");
document.getElementById("clearBtn").onclick = resetForm;

// ---------------- 5. THE SMART SAVE & LOOKUP ----------------
document.getElementById("saveQSO").onclick = async function() {
  const btn = this;
  const call = document.getElementById("call").value.trim().toUpperCase();
  const latF = document.getElementById("lat"), lonF = document.getElementById("lon"), gridF = document.getElementById("grid");

  if (!call) return alert("Enter a callsign first");

  // Step 1: Lookup if fields are empty
  if (!latF.value && !lookupReady && !selectedId) {
    btn.disabled = true;
    btn.textContent = "Searching FCC...";
    
    // Using AllOrigins Proxy + Callook.info (Most reliable for US)
    const proxy = "https://api.allorigins.win/get?url=";
    const target = encodeURIComponent(`https://callook.info/${call}/json`);

    try {
      const resp = await fetch(proxy + target);
      if (!resp.ok) throw new Error("Proxy connection failed.");
      
      const wrapper = await resp.json();
      const data = JSON.parse(wrapper.contents);

      if (data.status === "VALID") {
        latF.value = data.location.latitude || "";
        lonF.value = data.location.longitude || "";
        gridF.value = data.location.gridsquare || "";
        
        btn.textContent = "Verify & Save";
        btn.style.background = "#28a745";
        lookupReady = true;
      } else {
        alert("Not Found in FCC Database. Try manual entry.");
        btn.textContent = "Manual Save";
        lookupReady = true;
      }
    } catch (err) {
      alert("Lookup Error: " + err.message + "\n\nThis is usually a internet timeout. You can still save manually.");
      btn.textContent = "Save Manual";
      lookupReady = true;
    } finally {
      btn.disabled = false;
    }
    return;
  }

  // Step 2: Final Save
  const qso = {
    call, lat: parseFloat(latF.value) || null, lon: parseFloat(lonF.value) || null,
    band: document.getElementById("band").value.trim(), mode: document.getElementById("mode").value.trim(), grid: gridF.value.trim()
  };
  if (selectedId) qso.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").put(qso);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- 6. HELPERS ----------------
function resetForm() {
  selectedId = null; lookupReady = false;
  document.querySelectorAll("#editor input").forEach(i => i.value = "");
  const b = document.getElementById("saveQSO");
  b.textContent = "Save QSO"; b.style.background = "";
  document.getElementById("deleteQSO").style.display = "none";
}

function selectQSO(q) {
  selectedId = q.id; lookupReady = true;
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
  if (!selectedId || !confirm("Delete this entry?")) return;
  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").delete(selectedId);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// ---------------- 7. EXPORT / BACKUP ----------------
document.getElementById("exportADIF").onclick = () => {
  let out = "ADIF Export\n<EOH>\n";
  qsos.forEach(q => { out += `<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`; });
  download(out, "log.adi", "text/plain");
};

document.getElementById("backupBtn").onclick = () => download(JSON.stringify(qsos, null, 2), "backup.json", "application/json");

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

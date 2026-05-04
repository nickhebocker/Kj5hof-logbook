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

// ---------------- ADDRESS VALIDATION & SAVE ----------------
document.getElementById("saveQSO").onclick = async function() {
  const btn = this;
  const call = document.getElementById("call").value.trim().toUpperCase();
  const latF = document.getElementById("lat"), lonF = document.getElementById("lon"), gridF = document.getElementById("grid");

  if (!call) return alert("Enter Callsign");

  if (!latF.value && !lookupAttempted && !selectedId) {
    btn.textContent = "Searching...";
    btn.disabled = true;

    try {
      const target = `https://callook.info/${call}/json`;
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;
      
      const r = await fetch(proxy);
      const j = await r.json(); 
      const data = JSON.parse(j.contents);

      if (data && data.status === "VALID") {
        // CASE: We have the address but NO coordinates (The Apartment Problem)
        if (!data.location.latitude || data.location.latitude === "") {
          const rawAddr = `${data.address.line1}, ${data.address.line2}`;
          
          // Programmatically strip APT, UNIT, #, etc. to create a "Fixed" version
          let fixedAddr = data.address.line1
            .replace(/(APPT|APT|UNIT|STE|SUITE|#).*$/i, "") // Removes from Apt onwards
            .trim();
          fixedAddr = `${fixedAddr}, ${data.address.line2}`;

          // PROMPT: The "Did you mean?" experience
          const userChoice = prompt(
            `Callsign found, but map coordinates are missing.\n\n` +
            `Original: ${rawAddr}\n` +
            `Fixed: ${fixedAddr}\n\n` +
            `Press OK to use the FIXED address, or type a custom address below:`, 
            fixedAddr
          );

          if (userChoice) {
            btn.textContent = "Locating...";
            const geoTarget = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(userChoice)}`;
            const geoResp = await fetch(geoTarget);
            const geoData = await geoResp.json();

            if (geoData && geoData.length > 0) {
              const res = geoData[0];
              latF.value = parseFloat(res.lat).toFixed(4);
              lonF.value = parseFloat(res.lon).toFixed(4);
              gridF.value = latLonToGrid(res.lat, res.lon);
              
              btn.textContent = "Verify & Save";
              btn.style.background = "#28a745";
            } else {
              alert("Map couldn't find that address. Please enter details manually.");
              btn.textContent = "Save Manual";
              btn.style.background = "#fd7e14";
            }
          }
        } else {
          // Standard Case: Lat/Lon already provided by FCC
          latF.value = data.location.latitude;
          lonF.value = data.location.longitude;
          gridF.value = data.location.gridsquare;
          btn.textContent = "Confirm & Save";
          btn.style.background = "#28a745";
        }
      } else {
        alert("Not in FCC records.");
        btn.textContent = "Save Manual";
      }
    } catch (e) { 
      alert("Search failed. Entering manual mode.");
      btn.textContent = "Save Anyway";
    }
    
    lookupAttempted = true; 
    btn.disabled = false;
    return;
  }

  // Final Save Logic
  const qso = {
    call, lat: parseFloat(latF.value) || null, lon: parseFloat(lonF.value) || null,
    band: document.getElementById("band").value.trim(), mode: document.getElementById("mode").value.trim(), grid: gridF.value.trim()
  };
  if (selectedId) qso.id = selectedId;

  const tx = db.transaction("qsos", "readwrite");
  tx.objectStore("qsos").put(qso);
  tx.oncomplete = () => { resetForm(); loadAll(); };
};

// --- HELPER: Maidenhead Calculation ---
function latLonToGrid(lat, lon) {
  lat = parseFloat(lat) + 90;
  lon = parseFloat(lon) + 180;
  const grid = 
    String.fromCharCode(65 + Math.floor(lon / 20)) +
    String.fromCharCode(65 + Math.floor(lat / 10)) +
    Math.floor((lon % 20) / 2).toString() +
    Math.floor(lat % 10).toString() +
    String.fromCharCode(97 + Math.floor((lon % 2) * 12)) +
    String.fromCharCode(97 + Math.floor((lat % 1) * 24));
  return grid.substring(0, 6).toUpperCase();
}

// ---------------- OTHERS ----------------
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

// ---------------- EXPORT ----------------
document.getElementById("exportADIF").onclick = () => {
  let out = "ADIF Export\n<EOH>\n";
  qsos.forEach(q => { out += `<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`; });
  download(out, "log.adi", "text/plain");
};
document.getElementById("backupBtn").onclick = () => download(JSON.stringify(qsos), "backup.json", "application/json");
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

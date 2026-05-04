// app.js – fully fixed, no placeholders

// ---------------- MAP SETUP ----------------
const map = L.map("map").setView([39, -98], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const cluster = L.markerClusterGroup();
map.addLayer(cluster);

// ---------------- STATE ----------------
let db;
let qsos = [];
let selectedId = null;

// ---------------- INDEXEDDB ----------------
const dbReq = indexedDB.open("logbook", 1);

dbReq.onupgradeneeded = e => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains("qsos")) {
    db.createObjectStore("qsos", { keyPath: "id", autoIncrement: true });
  }
};

dbReq.onsuccess = e => {
  db = e.target.result;
  seedIfEmpty();
};

function seedIfEmpty() {
  const tx = db.transaction("qsos", "readonly");
  const store = tx.objectStore("qsos");
  const countReq = store.count();

  countReq.onsuccess = () => {
    if (countReq.result === 0) {
      fetch("logbook.json")
        .then(r => r.json())
        .then(seed => {
          const t = db.transaction("qsos", "readwrite");
          const s = t.objectStore("qsos");
          seed.forEach(q => {
            delete q.id;
            s.add(q);
          });
          t.oncomplete = loadAll;
        });
    } else {
      loadAll();
    }
  };
}

// ---------------- LOAD / RENDER ----------------
function loadAll() {
  qsos = [];
  const tx = db.transaction("qsos", "readonly");
  const store = tx.objectStore("qsos");

  store.openCursor().onsuccess = e => {
    const c = e.target.result;
    if (c) {
      qsos.push(c.value);
      c.continue();
    } else {
      render();
    }
  };
}

function render() {
  cluster.clearLayers();

  const bandFilter = document.getElementById("bandFilter").value;
  const modeFilter = document.getElementById("modeFilter").value;

  const filtered = qsos.filter(q =>
    (!bandFilter || q.band === bandFilter) &&
    (!modeFilter || q.mode === modeFilter)
  );

  const bands = new Set();
  const modes = new Set();

  filtered.forEach(q => {
    bands.add(q.band);
    modes.add(q.mode);

    if (typeof q.lat !== "number" || typeof q.lon !== "number") return;

    const marker = L.circleMarker([q.lat, q.lon], {
      radius: 8,
      color: q.band === "20m" ? "red" :
             q.band === "40m" ? "blue" : "green"
    });

    marker.on("click", () => selectQSO(q));
    marker.bindPopup(
      `${q.call}<br>${q.band} ${q.mode}<br>${q.grid || ""}`
    );

    cluster.addLayer(marker);
  });

  updateFilters(bands, modes);
  document.getElementById("stats").textContent =
    `Total QSOs: ${filtered.length}`;
}

function updateFilters(bands, modes) {
  const bandSel = document.getElementById("bandFilter");
  const modeSel = document.getElementById("modeFilter");

  if (bandSel.options.length === 0) {
    bandSel.innerHTML =
      `<option value="">All Bands</option>` +
      [...new Set(qsos.map(q => q.band))]
        .map(b => `<option value="${b}">${b}</option>`).join("");
  }

  if (modeSel.options.length === 0) {
    modeSel.innerHTML =
      `<option value="">All Modes</option>` +
      [...new Set(qsos.map(q => q.mode))]
        .map(m => `<option value="${m}">${m}</option>`).join("");
  }
}

// ---------------- UI ----------------
function selectQSO(q) {
  selectedId = q.id;
  ["call", "lat", "lon", "band", "mode", "grid"].forEach(f => {
    document.getElementById(f).value = q[f] ?? "";
  });
}

document.getElementById("bandFilter").onchange = render;
document.getElementById("modeFilter").onchange = render;

document.getElementById("saveQSO").onclick = () => {
  const q = {
    call: call.value.trim(),
    lat: Number(lat.value),
    lon: Number(lon.value),
    band: band.value.trim(),
    mode: mode.value.trim(),
    grid: grid.value.trim()
  };

  const tx = db.transaction("qsos", "readwrite");
  const store = tx.objectStore("qsos");

  if (selectedId) {
    q.id = selectedId;
    store.put(q);
  } else {
    store.add(q);
  }

  tx.oncomplete = () => {
    selectedId = null;
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

document.getElementById("zoomFiltered").onclick = () => {
  const layers = cluster.getLayers();
  if (layers.length) {
    const group = L.featureGroup(layers);
    map.fitBounds(group.getBounds());
  }
};

// ---------------- IMPORT / EXPORT ----------------
document.getElementById("exportADIF").onclick = () => {
  let out = "<EOH>\n";
  qsos.forEach(q => {
    out += `<CALL:${q.call.length}>${q.call}`;
    out += `<BAND:${q.band.length}>${q.band}`;
    out += `<MODE:${q.mode.length}>${q.mode}<EOR>\n`;
  });
  download(out, "log.adi");
};

document.getElementById("exportCSV").onclick = () => {
  let out = "call,lat,lon,band,mode,grid\n";
  qsos.forEach(q => {
    out += `${q.call},${q.lat},${q.lon},${q.band},${q.mode},${q.grid || ""}\n`;
  });
  download(out, "log.csv");
};

document.getElementById("backupBtn").onclick = () => {
  const clean = qsos.map(q => {
    const c = { ...q };
    delete c.id;
    return c;
  });
  download(JSON.stringify(clean, null, 2), "backup.json");
};

document.getElementById("restoreInput").onchange = e => {
  const r = new FileReader();
  r.onload = () => {
    const data = JSON.parse(r.result);
    const tx = db.transaction("qsos", "readwrite");
    const store = tx.objectStore("qsos");
    data.forEach(q => {
      delete q.id;
      store.add(q);
    });
    tx.oncomplete = loadAll;
  };
  r.readAsText(e.target.files[0]);
};

document.getElementById("importADIF").onchange = e => {
  const r = new FileReader();
  r.onload = () => {
    const tx = db.transaction("qsos", "readwrite");
    const store = tx.objectStore("qsos");

    r.result.split("<EOR>").forEach(rec => {
      const call = /<CALL:\d+>([^<]+)/.exec(rec);
      const band = /<BAND:\d+>([^<]+)/.exec(rec);
      const mode = /<MODE:\d+>([^<]+)/.exec(rec);

      if (call && band && mode) {
        store.add({
          call: call[1],
          band: band[1],
          mode: mode[1],
          lat: null,
          lon: null,
          grid: ""
        });
      }
    });
    tx.oncomplete = loadAll;
  };
  r.readAsText(e.target.files[0]);
};

// ---------------- THEME ----------------
document.getElementById("darkToggle").onclick = () => {
  document.body.classList.toggle("dark");
};

// ---------------- UTIL ----------------
function download(text, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = name;
  a.click();
}

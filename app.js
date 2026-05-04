const map = L.map("map").setView([39.0, -98.0], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// Load QSOs from JSON
fetch("logbook.json")
  .then(response => response.json())
  .then(logbook => {
    logbook.forEach(qso => {
      L.marker([qso.lat, qso.lon])
        .addTo(map)
        .bindPopup(
          `<strong>${qso.call}</strong><br>
           ${qso.band} ${qso.mode}<br>
           ${qso.note}`
        );
    });
  })
  .catch(err => console.error("Failed to load logbook:", err));

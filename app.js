const map = L.map("map").setView([39.0, -98.0], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// Example QSO pin
L.marker([30.2672, -97.7431])
  .addTo(map)
  .bindPopup("Austin, TX<br>20m SSB");

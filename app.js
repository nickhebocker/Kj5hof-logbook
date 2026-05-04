// app.js
const map = L.map("map").setView([39, -98], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
const cluster = L.markerClusterGroup();
map.addLayer(cluster);

let qsos=[];
let selectedId=null;

const dbReq=indexedDB.open("logbook",1);
dbReq.onupgradeneeded=e=>e.target.result.createObjectStore("qsos",{keyPath:"id",autoIncrement:true});
dbReq.onsuccess=e=>{db=e.target.result;loadSeed();};

function loadSeed(){
 fetch("logbook.json").then(r=>r.json()).then(seed=>{
  const tx=db.transaction("qsos","readwrite"),s=tx.objectStore("qsos");
  seed.forEach(q=>s.add(q));
  tx.oncomplete=loadAll;
 });
}

function loadAll(){
 qsos=[];
 const tx=db.transaction("qsos","readonly"),s=tx.objectStore("qsos");
 s.openCursor().onsuccess=e=>{
  const c=e.target.result;
  if(c){qsos.push(c.value);c.continue();}
  else{render();}
 };
}

function render(){
 cluster.clearLayers();
 let bands=new Set(),modes=new Set();
 qsos.forEach(q=>{
  bands.add(q.band);modes.add(q.mode);
  const icon=L.circleMarker([q.lat,q.lon],{
    radius:8,
    color: q.band==="20m"?"red":q.band==="40m"?"blue":"green"
  }).on("click",()=>selectQSO(q));
  icon.bindPopup(`${q.call}<br>${q.band} ${q.mode}<br>${q.grid||""}`);
  cluster.addLayer(icon);
 });
 document.getElementById("bandFilter").innerHTML=["",...bands].map(b=>`<option>${b}</option>`).join("");
 document.getElementById("modeFilter").innerHTML=["",...modes].map(m=>`<option>${m}</option>`).join("");
 document.getElementById("stats").textContent=`Total QSOs: ${qsos.length}`;
}

function selectQSO(q){
 selectedId=q.id;
 ["call","lat","lon","band","mode","grid"].forEach(f=>document.getElementById(f).value=q[f]||"");
}

document.getElementById("saveQSO").onclick=()=>{
 const q={id:selectedId,
  call:call.value,lat:+lat.value,lon:+lon.value,
  band:band.value,mode:mode.value,grid:grid.value};
 const tx=db.transaction("qsos","readwrite"),s=tx.objectStore("qsos");
 selectedId?s.put(q):s.add(q);
 tx.oncomplete=loadAll;
};

document.getElementById("deleteQSO").onclick=()=>{
 if(!selectedId)return;
 const tx=db.transaction("qsos","readwrite"),s=tx.objectStore("qsos");
 s.delete(selectedId);
 tx.oncomplete=()=>{selectedId=null;loadAll();};
};

document.getElementById("zoomFiltered").onclick=()=>{
 const layers=cluster.getLayers();
 const group=new L.featureGroup(layers);
 map.fitBounds(group.getBounds());
};

document.getElementById("exportADIF").onclick=()=>{
 let t="<EOH>\n";
 qsos.forEach(q=>{
  t+=`<CALL:${q.call.length}>${q.call}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<EOR>\n`;
 });
 download(t,"log.adi");
};

document.getElementById("exportCSV").onclick=()=>{
 let t="call,lat,lon,band,mode,grid\n";
 qsos.forEach(q=>t+=`${q.call},${q.lat},${q.lon},${q.band},${q.mode},${q.grid||""}\n`);
 download(t,"log.csv");
};

document.getElementById("importADIF").onchange=e=>{
 const r=new FileReader();
 r.onload=()=>{
  const tx=db.transaction("qsos","readwrite"),s=tx.objectStore("qsos");
  r.result.split("<EOR>").forEach(rec=>{
   const c=/<CALL:\d+>([^<]+)/.exec(rec);
   const b=/<BAND:\d+>([^<]+)/.exec(rec);
   const m=/<MODE:\d+>([^<]+)/.exec(rec);
   if(c&&b&&m)s.add({call:c[1],band:b[1],mode:m[1],lat:0,lon:0});
  });
 };
 r.readAsText(e.target.files[0]);
};

function download(text,name){
 const a=document.createElement("a");
 a.href=URL.createObjectURL(new Blob([text]));
 a.download=name;a.click();
}

document.getElementById("backupBtn").onclick=()=>{
 download(JSON.stringify(qsos),"backup.json");
};

document.getElementById("restoreInput").onchange=e=>{
 const r=new FileReader();
 r.onload=()=>{
  const tx=db.transaction("qsos","readwrite"),s=tx.objectStore("qsos");
  JSON.parse(r.result).forEach(q=>s.add(q));
  tx.oncomplete=loadAll;
 };
 r.readAsText(e.target.files[0]);
};

document.getElementById("darkToggle").onclick=()=>{
 document.body.classList.toggle("dark");
};

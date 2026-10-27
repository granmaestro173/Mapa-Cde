(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DAY = 864e5, HOUR = 36e5;
const fmtGs = n => "Gs. " + Math.round(n || 0).toLocaleString("es-PY");
const fmtN = n => Math.round(n).toLocaleString("es-PY");

/* ---------- Categorías ---------- */
const ICONS = {
  bache:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 17h18"/><path d="M7 17c1-3 3-4 5-4s4 1 5 4"/></svg>',
  inundacion:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2 10c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/></svg>',
  animal:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="10" r="2.2"/><circle cx="10" cy="6" r="2.2"/><circle cx="14" cy="6" r="2.2"/><circle cx="18" cy="10" r="2.2"/><path d="M12 11c-3 0-6 4-6 7 0 2 2 2 3 2s2-1 3-1 2 1 3 1 3 0 3-2c0-3-3-7-6-7z"/></svg>',
  semaforo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="8" y="2.5" width="8" height="19" rx="2.5"/><circle cx="12" cy="7.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor"/></svg>',
  inseguro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 17H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
  asalto:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
  basura:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>',
  alumbrado:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>'
};
const CATS = {
  bache:{n:"Baches", one:"Bache", w:1.0},
  inundacion:{n:"Inundaciones", one:"Inundación", w:1.2},
  animal:{n:"Animales muertos", one:"Animal muerto", w:0.8},
  semaforo:{n:"Semáforos sin funcionar", one:"Semáforo sin funcionar", w:1.3},
  inseguro:{n:"Zonas inseguras", one:"Zona insegura", w:1.1},
  asalto:{n:"Asaltos", one:"Asalto", w:1.5},
  basura:{n:"Basura acumulada", one:"Basura acumulada", w:0.7},
  alumbrado:{n:"Alumbrado apagado", one:"Alumbrado apagado", w:0.9}
};
const CAT_KEYS = Object.keys(CATS);
const cvar = k => `var(--c-${k})`;
const STATUS = {recibida:"Recibida", en_proceso:"En proceso", resuelta:"Resuelta"};

/* ---------- Geografía de Ciudad del Este (orilla del Paraná y lago trazados sobre la imagen satelital) ---------- */
const RIVER_W = [[-25.4,-54.6217],[-25.4532,-54.6217],[-25.4582,-54.6216],[-25.4631,-54.6216],[-25.4681,-54.6202],[-25.473,-54.6167],[-25.478,-54.6113],[-25.483,-54.6051],[-25.4879,-54.6047],[-25.4929,-54.6006],[-25.4978,-54.6045],[-25.5028,-54.6032],[-25.5077,-54.6032],[-25.5127,-54.6032],[-25.5177,-54.603],[-25.5226,-54.6027],[-25.5276,-54.6013],[-25.5325,-54.6001],[-25.5375,-54.5966],[-25.5424,-54.5966],[-25.5474,-54.5966],[-25.5524,-54.5966],[-25.5573,-54.5966],[-25.5623,-54.5966],[-25.5672,-54.5966],[-25.5722,-54.5962],[-25.5771,-54.5955],[-25.5821,-54.5955],[-25.587,-54.5952],[-25.62,-54.595150000000004]];
const LAKE = [[-25.51111,-54.61969],[-25.51169,-54.61819],[-25.51363,-54.61767],[-25.51634,-54.6181],[-25.51828,-54.61969],[-25.52021,-54.62183],[-25.52254,-54.62368],[-25.52409,-54.6257],[-25.52455,-54.62668],[-25.52138,-54.62557],[-25.51905,-54.62428],[-25.51712,-54.62385],[-25.51479,-54.62256],[-25.51247,-54.62119]];
const BARRIOS = [
  {n:"Microcentro", c:[-25.5085,-54.6095], r:.0035, w:{asalto:6,inseguro:4,semaforo:5,basura:3,bache:2,alumbrado:1,animal:.3,inundacion:1.5}},
  {n:"Área 1", c:[-25.4985,-54.6125], r:.004, w:{asalto:2,inseguro:1.5,semaforo:2,basura:1,bache:2,alumbrado:2,animal:.5,inundacion:.6}},
  {n:"Boquerón", c:[-25.5225,-54.6155], r:.0045, w:{asalto:3,inseguro:3,semaforo:1,basura:3,bache:4,alumbrado:3,animal:1,inundacion:4}},
  {n:"San Isidro", c:[-25.5285,-54.6325], r:.005, w:{asalto:2,inseguro:2,semaforo:.5,basura:2,bache:4,alumbrado:3,animal:2,inundacion:2}},
  {n:"Barrio Obrero", c:[-25.4965,-54.6345], r:.0045, w:{asalto:3,inseguro:2.5,semaforo:1,basura:2,bache:3,alumbrado:2,animal:1.5,inundacion:1}},
  {n:"Ciudad Nueva", c:[-25.5055,-54.6455], r:.005, w:{asalto:2.5,inseguro:2,semaforo:1.5,basura:2,bache:3,alumbrado:2,animal:1.5,inundacion:1.5}},
  {n:"San Rafael", c:[-25.5345,-54.6125], r:.0045, w:{asalto:2.5,inseguro:2.5,semaforo:.5,basura:2.5,bache:3,alumbrado:3,animal:1.5,inundacion:3}},
  {n:"Km 7", c:[-25.5095,-54.6635], r:.005, w:{asalto:4,inseguro:3,semaforo:2,basura:2,bache:3,alumbrado:2,animal:2,inundacion:1}},
  {n:"Km 8 Acaray", c:[-25.4935,-54.6795], r:.006, w:{asalto:2,inseguro:2,semaforo:1,basura:2,bache:3,alumbrado:2.5,animal:3,inundacion:1.5}},
  {n:"Remansito", c:[-25.4815,-54.6185], r:.005, w:{asalto:1.5,inseguro:1.5,semaforo:.5,basura:1.5,bache:2.5,alumbrado:2,animal:2,inundacion:2.5}},
  {n:"Don Bosco", c:[-25.5275,-54.6535], r:.005, w:{asalto:2,inseguro:2,semaforo:.5,basura:2,bache:3,alumbrado:2,animal:2,inundacion:1.5}},
  {n:"Pablo Rojas", c:[-25.4885,-54.6455], r:.005, w:{asalto:1.5,inseguro:1.5,semaforo:.5,basura:1.5,bache:2.5,alumbrado:2,animal:2,inundacion:1}},
];
const DEPOT = [-25.5032,-54.6338];

function inPoly([y,x], poly){let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [yi,xi]=poly[i],[yj,xj]=poly[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins}return ins}
function riverWestLng(lat){for(let i=0;i<RIVER_W.length-1;i++){const [a1,b1]=RIVER_W[i],[a2,b2]=RIVER_W[i+1];if(lat<=a1&&lat>=a2)return b1+(b2-b1)*(lat-a1)/(a2-a1)}return -54.6}
const onLand = p => p[1] < riverWestLng(p[0]) - 0.0004 && !inPoly(p, LAKE);
function distM(a,b){const R=6371e3,r=Math.PI/180,dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r;const h=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
const nearestBarrio = p => BARRIOS.reduce((best,b)=>{const d=distM(p,b.c);return d<best.d?{d,n:b.n}:best},{d:Infinity,n:"—"}).n;

/* ---------- Estado ---------- */
const PERIODS = {dia:{n:"Día", label:"últimas 24 h", ms:DAY}, semana:{n:"Semana", label:"últimos 7 días", ms:7*DAY}, mes:{n:"Mes", label:"últimos 30 días", ms:30*DAY}, anio:{n:"Año", label:"últimos 12 meses", ms:365*DAY}};
const state = {period:"mes", cats:new Set(CAT_KEYS), showRes:true, showDemo:true, onlyPhoto:false, near:{on:false, c:null, r:1000, src:null}, heat:false, heatSlot:"", sel:null, muni:false, staff:false};
try { const p = localStorage.getItem("cde-period"); if (p && PERIODS[p]) state.period = p; } catch(e) {}
const live = new Map();      // denuncias de la base (Supabase) o del modo de prueba
const obrasLive = new Map();
let auditLive = [];

// Las denuncias marcadas como falsas salen de todo (mapa, listas, conteos, estadísticas, obras);
// solo quedan en "Descartadas como falsas" del panel de moderación, para poder revisarlas o quitar la marca, y en el historial.
const rawReportsAll = () => [...live.values()].filter(r => state.showDemo || !r.demo);
const allReports = () => rawReportsAll().filter(r => r.mod !== "falsa");
const hasPhoto = r => !!(r.photo || r.hasPhoto);
const MINE_KEY = "cde-mis-votos";
let mine = {}; try { mine = JSON.parse(localStorage.getItem(MINE_KEY) || "{}"); } catch(e) {}
const markMine = (id, k) => { mine[id+":"+k] = 1; try { localStorage.setItem(MINE_KEY, JSON.stringify(mine)); } catch(e) {} };
const findReport = id => live.get(id);
const inPeriod = (r, per=state.period, now=Date.now()) => r.t > now - PERIODS[per].ms && r.t <= now;

/* ---------- Toast ---------- */
let toastT; function toast(msg){ const el=$("#toast"); el.textContent=msg; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>el.hidden=true, 3400); }
const ago = t => { const m = Math.round((Date.now()-t)/6e4); if (m<1) return "recién"; if (m<60) return `hace ${m} min`; const h=Math.round(m/60); if (h<24) return `hace ${h} h`; const d=Math.round(h/24); if (d<31) return `hace ${d} d`; return new Date(t).toLocaleDateString("es-PY",{day:"numeric",month:"short"}); };

/* ---------- Mapa ---------- */
// Imágenes satelitales de Esri (World Imagery) en teselas. Si el servicio no responde, se usa la imagen
// fija incluida en la página: liviana (0,7 MB) en celulares y HD (2,9 MB) en computadoras o al acercarse mucho.
const MOBILE = matchMedia("(max-width:760px)");
const SAVE_DATA = !!navigator.connection?.saveData;
const LITE = MOBILE.matches || SAVE_DATA || (navigator.deviceMemory || 8) < 4;
const SAT_BOUNDS = [[-25.591994,-54.722900],[-25.453195,-54.580078]];
const map = L.map("map", {attributionControl:true, minZoom:13, maxZoom:19, zoomSnap:.5, preferCanvas:LITE, zoomControl:false, maxBounds:SAT_BOUNDS, maxBoundsViscosity:1}).setView(MOBILE.matches ? [-25.51,-54.625] : [-25.512,-54.638], MOBILE.matches ? 13 : 13.5);
if (!MOBILE.matches) L.control.zoom({position:"bottomright"}).addTo(map);
map.attributionControl.setPrefix(false).addAttribution("Imágenes © Esri, Maxar, Earthstar Geographics");
let tileErrors = 0, satLayer = null;
const tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxNativeZoom:18, maxZoom:19, bounds:SAT_BOUNDS, crossOrigin:true}).addTo(map);
tiles.on("tileerror", () => { if (++tileErrors === 6 && !satLayer) useStaticSat(); });
function useStaticSat(){
  map.removeLayer(tiles);
  satLayer = L.imageOverlay(LITE ? "sat-lite.jpg" : "sat-hd.jpg", SAT_BOUNDS, {interactive:false, alt:"Imagen satelital de Ciudad del Este"}).addTo(map);
  if (LITE && !SAVE_DATA && (navigator.deviceMemory || 4) >= 4)
    map.on("zoomend", function hd(){ if (map.getZoom() >= 16){ satLayer.setUrl("sat-hd.jpg"); map.off("zoomend", hd); } });
}
L.marker(DEPOT, {keyboard:false, title:"Depósito municipal de obras (referencia para el traslado)", icon:L.divIcon({className:"", html:'<div class="depot"></div>', iconSize:[14,14], iconAnchor:[7,7]})}).addTo(map)
  .bindTooltip("Depósito municipal de obras (referencia)");

const heatLayer = L.layerGroup();
const pinLayer = L.layerGroup().addTo(map);
const markers = new Map();
let pickMarker = null, pickMode = false, pickLatLng = null;

const CAM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h6l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5z"/><circle cx="12" cy="13" r="3.6" fill="var(--panel)"/></svg>';
function iconFor(r, sel){
  const hot = r.votes >= 8 && r.status !== "resuelta";
  return L.divIcon({className:"", iconSize:[26,26], iconAnchor:sel?[17,34]:[13,26],
    html:`<div class="pinw"><div class="pin ${r.status==="resuelta"?"res":""} ${hot?"hot":""} ${sel?"sel":""} ${r.mod==="falsa"?"fake":""}" style="--c:${cvar(r.cat)}">${ICONS[r.cat]}</div>${hasPhoto(r) ? `<span class="cam" title="Con foto">${CAM}</span>` : ""}</div>`});
}
function visibleReports(){
  return allReports().filter(r => state.cats.has(r.cat) && inPeriod(r) && (state.showRes || r.status !== "resuelta") && (!state.onlyPhoto || hasPhoto(r)) && nearOK(r));
}
const nearActive = () => state.near.on && !!state.near.c;
const nearOK = r => !nearActive() || distM(state.near.c, [r.lat, r.lng]) <= state.near.r;
const fmtDist = m => m < 1000 ? `${Math.round(m/10)*10} m` : `${(m/1000).toFixed(1).replace(".", ",")} km`;
function renderPins(){
  const vis = visibleReports();
  const ids = new Set(vis.map(r => r.id));
  for (const [id,m] of markers) if (!ids.has(id)) { pinLayer.removeLayer(m); markers.delete(id); }
  for (const r of vis){
    const key = r.status + r.votes + (state.sel===r.id) + hasPhoto(r) + (r.mod||"");
    let m = markers.get(r.id);
    if (!m){
      m = L.marker([r.lat, r.lng], {icon:iconFor(r, state.sel===r.id), title:CATS[r.cat].one + " · " + r.barrio, riseOnHover:true});
      m._k = key; m.on("click", () => pickMode ? setPick([r.lat, r.lng]) : openDetail(r.id)); m.addTo(pinLayer); markers.set(r.id, m);
    } else if (m._k !== key){ m.setIcon(iconFor(r, state.sel===r.id)); m._k = key; m.setLatLng([r.lat,r.lng]); }
    if (state.sel===r.id) m.setZIndexOffset(1000); else m.setZIndexOffset(0);
  }
  $("#legendCount").textContent = fmtN(vis.length); $("#mCount").textContent = fmtN(vis.length); $("#fCount").textContent = fmtN(vis.length); renderFilterUI();
  if (state.heat) renderHeat();
}
// Zonas de riesgo: la ciudad se divide en celdas de ~200 m. Cada denuncia suma según su tipo, gravedad,
// antigüedad, confirmaciones de vecinos y verificación municipal, y derrama un poco a las celdas vecinas.
const HEAT_CELL = .002, SLOTS = {m:[6,12,"la mañana"], t:[12,18,"la tarde"], n:[18,24,"la noche"], d:[0,6,"la madrugada"]};
const inSlot = (r, k) => { if (!k) return true; const h = new Date(r.t).getHours(); return h >= SLOTS[k][0] && h < SLOTS[k][1]; };
function heatWeight(r, now){
  return CATS[r.cat].w * (.6 + (r.sev||3)*.16) * Math.exp(-(now - r.t)/(75*DAY)) * (1 + Math.log2(1 + (r.votes||0))*.25) * (r.mod==="verificada" ? 1.4 : 1);
}
let heatCells = new Map();
function renderHeat(){
  heatLayer.clearLayers();
  const now = Date.now(), cell = HEAT_CELL, grid = new Map();
  heatCells = new Map();
  for (const r of allReports()){
    if (!state.cats.has(r.cat) || r.status==="resuelta" && now - r.t > 60*DAY || !inSlot(r, state.heatSlot)) continue;
    const w = heatWeight(r, now);
    const gx = Math.round(r.lng/cell), gy = Math.round(r.lat/cell);
    const k0 = gy+","+gx; if (!heatCells.has(k0)) heatCells.set(k0, []); heatCells.get(k0).push(r);
    for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++){
      const k = (gy+dy)+","+(gx+dx), f = dx||dy ? (dx&&dy?.25:.45) : 1;
      grid.set(k, (grid.get(k)||0) + w*f);
    }
  }
  const vals = [...grid.values()].sort((a,b)=>a-b); const ref = vals[Math.floor(vals.length*.97)] || 1;
  for (const [k,v] of grid){
    const n = Math.min(1, v/ref); if (n < .18) continue;
    const [gy,gx] = k.split(",").map(Number), p = [gy*cell, gx*cell];
    if (!onLand(p)) continue;
    const col = n > .7 ? "#d1263b" : n > .42 ? "#f08a24" : "#ffd34d";
    const c = L.circle(p, {radius:150, stroke:false, fillColor:col, fillOpacity:.12 + n*.38, interactive:n > .42, bubblingMouseEvents:false}).addTo(heatLayer);
    if (n > .42) c.on("click", e => { L.DomEvent.stop(e); if (pickMode || nearPicking) return; openZone(gy, gx, n, p); });
  }
}
// Resumen de una zona (la celda tocada y sus vecinas). Siempre se calcula en la página; si la IA está configurada, Claude lo puede explicar a pedido.
function zoneStats(gy, gx){
  const rs = []; for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) rs.push(...(heatCells.get((gy+dy)+","+(gx+dx)) || []));
  const now = Date.now(), byCat = {}, hours = Array(24).fill(0);
  rs.forEach(r => { byCat[r.cat] = (byCat[r.cat]||0) + 1; hours[new Date(r.t).getHours()]++; });
  const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const peak = hours.indexOf(Math.max(...hours));
  return {rs, cats, hours, peak, recientes:rs.filter(r => now - r.t < 30*DAY).length, abiertas:rs.filter(r => r.status!=="resuelta").length,
    verificadas:rs.filter(r => r.mod==="verificada").length, gravedad:rs.length ? +(rs.reduce((a,r)=>a+(r.sev||3),0)/rs.length).toFixed(1) : 0};
}
function zoneFallback(z, barrio, nivel){
  const top = z.cats[0] ? CATS[z.cats[0][0]].n.toLowerCase() : "denuncias";
  return `Riesgo ${nivel} en ${barrio}: se ${z.rs.length===1?"registra 1 denuncia":`acumulan ${z.rs.length} denuncias`} cerca, sobre todo de ${top}, ${z.recientes} en los últimos 30 días y ${z.abiertas} sin resolver. La mayoría ocurre alrededor de las ${z.peak}:00.\nRecomendación: ${z.cats[0]?.[0]==="asalto" || z.cats[0]?.[0]==="inseguro" ? "evitar transitar solo a esa hora y pedir patrullaje en la zona" : "circular con precaución y priorizar el arreglo en la cuadrilla municipal"}.`;
}
function openZone(gy, gx, n, p){
  const z = zoneStats(gy, gx), barrio = nearestBarrio(p), nivel = n > .7 ? "alto" : "medio";
  const slot = state.heatSlot ? ` · ${SLOTS[state.heatSlot][2]}` : "";
  const recent = z.rs.slice().sort((a,b)=>b.t-a.t).slice(0,6);
  showDrawer(`
    <div class="drawer-head"><div><div class="eyebrow">Zona de riesgo ${nivel}${slot}</div><h2>${esc(barrio)}</h2></div><button class="x" type="button" aria-label="Cerrar" data-close>×</button></div>
    <div class="drawer-body zone">
      <div class="zone-cats">${z.cats.slice(0,4).map(([k,c]) => `<span class="chip c" style="--c:${cvar(k)}">${esc(CATS[k].n)} ${c}</span>`).join("")}</div>
      <dl class="kv">
        <dt>Denuncias en ~200 m</dt><dd>${z.rs.length}</dd>
        <dt>Últimos 30 días</dt><dd>${z.recientes}</dd>
        <dt>Sin resolver</dt><dd>${z.abiertas}</dd>
        <dt>Gravedad media</dt><dd>${z.gravedad}/5</dd>
        <dt>Hora más frecuente</dt><dd>${z.peak}:00</dd>
      </dl>
      <div class="ai" id="zoneBox"><span class="ai-tag">Por qué es una zona de riesgo</span><div class="zone-ai" id="zoneAi">${esc(zoneFallback(z, barrio, nivel))}</div>${IA.enabled ? `<button class="btn small primary" type="button" id="btnZoneAi">✦ Explicar con IA</button>` : ""}</div>
      <div><div class="eyebrow" style="margin-bottom:4px">Denuncias de la zona</div><div class="feed" id="zoneFeed">${recent.map(r => `<button type="button" data-zid="${esc(r.id)}" style="--c:${cvar(r.cat)}"><span class="sw"></span><span class="d">${esc(r.desc || CATS[r.cat].one)}</span><span class="t">${esc(ago(r.t))}</span></button>`).join("")}</div></div>
    </div>`);
  $$("#zoneFeed [data-zid]").forEach(b => b.addEventListener("click", () => openDetail(b.dataset.zid)));
  if (IA.enabled) $("#btnZoneAi").addEventListener("click", async ev => {
    const btn = ev.currentTarget, out = $("#zoneAi"), tag = $("#zoneBox .ai-tag");
    btn.disabled = true; out.textContent = "Analizando la zona…";
    const datos = {barrio, nivel_riesgo:nivel, franja:state.heatSlot ? SLOTS[state.heatSlot][2] : "todo el día",
      total_cercanas:z.rs.length, ultimos_30_dias:z.recientes, sin_resolver:z.abiertas, verificadas_por_municipalidad:z.verificadas, gravedad_media:z.gravedad,
      por_categoria:Object.fromEntries(z.cats.map(([k,c]) => [CATS[k].n, c])), denuncias_por_hora:z.hours,
      ejemplos:recent.map(r => ({tipo:CATS[r.cat].one, hace_dias:Math.round((Date.now()-r.t)/DAY), descripcion:String(r.desc||"").slice(0,140)}))};
    try {
      out.textContent = await IA.ask("zona", datos);
      tag.textContent = "✦ Análisis de Claude";
    } catch(err){
      out.textContent = zoneFallback(z, barrio, nivel);
      toast(err.message || "La IA no respondió; se muestra el resumen automático.");
    }
    btn.hidden = true;
  });
}

map.on("click", e => {
  if (nearPicking) { setNearCenter([e.latlng.lat, e.latlng.lng], "mapa"); return; }
  if (MOBILE.matches && !$("#view-mapa").classList.contains("side-collapsed")) { setSide(false); return; }
  if (!pickMode) return;
  setPick([e.latlng.lat, e.latlng.lng]);
});
function setPick(p){
  if (!onLand(p)) { toast("Ese punto cae en el agua. Elegí un lugar en la ciudad."); return; }
  pickLatLng = p;
  if (!pickMarker){
    pickMarker = L.marker(p, {draggable:true, zIndexOffset:2000, icon:L.divIcon({className:"", iconSize:[34,34], iconAnchor:[17,34], html:`<div class="pin sel" style="--c:var(--ink)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>`})}).addTo(map);
    pickMarker.on("dragend", () => { const ll = pickMarker.getLatLng(); setPick([ll.lat, ll.lng]); });
  } else pickMarker.setLatLng(p);
  $("#pickBanner").hidden = true;
  const el = $("#fLoc"); if (el) el.innerHTML = `<b>${esc(nearestBarrio(p))}</b> <span class="mono note">${p[0].toFixed(5)}, ${p[1].toFixed(5)}</span>`;
  checkDuplicate();
}
function clearPick(){ document.body.classList.remove("picking"); pickMode=false; pickLatLng=null; $("#pickBanner").hidden=true; if (pickMarker){ map.removeLayer(pickMarker); pickMarker=null; } }

/* ---------- Panel lateral ---------- */
function renderPeriodSegs(){
  $$("[data-period-seg]").forEach(seg => {
    seg.innerHTML = Object.entries(PERIODS).map(([k,p]) => `<button type="button" data-p="${k}" aria-pressed="${state.period===k}">${p.n}</button>`).join("");
  });
  $$("[data-period-label]").forEach(el => el.textContent = PERIODS[state.period].label);
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-p]"); if (!b) return;
  state.period = b.dataset.p; try { localStorage.setItem("cde-period", state.period); } catch(e) {}
  refresh();
});
function buckets(per, now=Date.now()){
  if (per==="dia") return Array.from({length:24}, (_,i)=>{ const e=now-(23-i)*HOUR; return {s:e-HOUR, e, l:new Date(e).getHours()+"h"}; });
  if (per==="semana") return Array.from({length:7}, (_,i)=>{ const e=now-(6-i)*DAY; return {s:e-DAY, e, l:new Date(e-1).toLocaleDateString("es-PY",{weekday:"short"})}; });
  if (per==="mes") return Array.from({length:30}, (_,i)=>{ const e=now-(29-i)*DAY; return {s:e-DAY, e, l:new Date(e-1).getDate()+""}; });
  return Array.from({length:12}, (_,i)=>{ const e=now-(11-i)*30.4*DAY; return {s:e-30.4*DAY, e, l:new Date(e-DAY).toLocaleDateString("es-PY",{month:"short"})}; });
}
function renderSide(){
  const now = Date.now(), per = PERIODS[state.period];
  const rs = allReports();
  const as = rs.filter(r => r.cat==="asalto");
  const cur = as.filter(r => r.t > now-per.ms).length, prev = as.filter(r => r.t <= now-per.ms && r.t > now-2*per.ms).length;
  $("#asaltoBig").textContent = fmtN(cur);
  const d = $("#asaltoDelta");
  if (prev===0 && cur===0){ d.className="delta eq"; d.textContent="sin cambios"; }
  else { const pct = prev ? Math.round((cur-prev)/prev*100) : 100; d.className = "delta " + (pct>0?"up":pct<0?"down":"eq"); d.textContent = (pct>0?"▲ +":pct<0?"▼ ":"")+pct+"%"; }
  $("#asaltoNote").textContent = `${fmtN(prev)} en el período anterior · ${state.period==="anio"?"año móvil":per.label}`;
  const bk = buckets(state.period, now).map(b => as.filter(r => r.t>b.s && r.t<=b.e).length);
  const mx = Math.max(1, ...bk), bw = 300/bk.length;
  $("#asaltoSpark").innerHTML = bk.map((v,i)=>`<rect x="${(i*bw+bw*.15).toFixed(1)}" y="${(46-Math.max(1.5,v/mx*44)).toFixed(1)}" width="${(bw*.7).toFixed(1)}" height="${Math.max(1.5,v/mx*44).toFixed(1)}" rx="1.5" fill="var(--c-asalto)" opacity="${i===bk.length-1?1:.55}"/>`).join("");

  const inP = rs.filter(r => inPeriod(r, state.period, now));
  $("#cats").innerHTML = CAT_KEYS.map(k => `<button type="button" class="cat" data-cat="${k}" aria-pressed="${state.cats.has(k)}"><span class="dot" style="--c:${cvar(k)}">${ICONS[k]}</span><span>${CATS[k].n}</span><span class="n">${inP.filter(r=>r.cat===k).length}</span></button>`).join("");

  const latest = nearActive()
    ? visibleReports().map(r => (r._d = distM(state.near.c, [r.lat, r.lng]), r)).sort((a,b) => a._d-b._d).slice(0,10)
    : rs.slice().sort((a,b)=>b.t-a.t).slice(0,7);
  $("#feedTitle").textContent = nearActive() ? `Más cercanas · a menos de ${fmtDist(state.near.r)}` : "Últimas denuncias";
  const feed = $("#feed"), prevIds = new Set($$("button", feed).map(b=>b.dataset.id));
  feed.innerHTML = latest.map(r => `<button type="button" data-id="${esc(r.id)}" class="${prevIds.size && !prevIds.has(r.id) ? "new":""}"><span class="sw" style="--c:${cvar(r.cat)}"></span><span class="d"><b>${CATS[r.cat].one}</b> · ${esc(r.barrio)}</span><span class="t">${nearActive() ? `<span class="dist">${fmtDist(r._d)}</span> · ` : ""}${ago(r.t)}</span></button>`).join("") || `<div class="empty">${nearActive() ? "No hay denuncias en esta zona con los filtros elegidos." : "Todavía no hay denuncias."}</div>`;
}
$("#cats").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  const k = b.dataset.cat;
  if (e.altKey || (state.cats.size === CAT_KEYS.length && false)) {}
  state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k);
  refresh();
});
$("#feed").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) { const r=findReport(b.dataset.id); if (r){ setSide(false); map.flyTo([r.lat,r.lng], 16, {duration:.6}); openDetail(r.id); } } });
$("#tgHeat").addEventListener("change", e => { state.heat = e.target.checked; if (state.heat){ heatLayer.addTo(map); renderHeat(); } else { map.removeLayer(heatLayer); map.closePopup(); } $("#heatLegend").hidden = !state.heat; $("#heatSlotRow").hidden = !state.heat; });
$("#heatSlot").addEventListener("change", e => { state.heatSlot = e.target.value; map.closePopup(); if (state.heat) renderHeat(); });
$("#tgRes").addEventListener("change", e => { state.showRes = e.target.checked; refresh(); });
$("#tgPhoto").addEventListener("change", e => { state.onlyPhoto = e.target.checked; refresh(); });
$("#tgDemo").addEventListener("change", e => { state.showDemo = e.target.checked; refresh(); });

/* ---------- Cajón: detalle ---------- */
const drawer = $("#drawer");
function showDrawer(html){ setSide(false); $("#fpanel").hidden = true; $("#btnFilters").setAttribute("aria-expanded", false); document.body.classList.remove("picking"); drawer.scrollTop = 0; drawer.innerHTML = html; drawer.hidden = false; $("#view-mapa").classList.add("with-drawer"); setTimeout(()=>map.invalidateSize(), 50); }
function closeDrawer(){ drawer.hidden = true; $("#view-mapa").classList.remove("with-drawer"); state.sel = null; clearPick(); renderPins(); setTimeout(()=>map.invalidateSize(), 50); }
function priority(r){
  const ageD = (Date.now()-r.t)/DAY;
  const s = (r.sev||3)*2 + Math.log2(1+(r.votes||0))*1.6 + CATS[r.cat].w*2 + (r.status==="recibida" && ageD>7 ? 2 : 0);
  return s >= 12.5 ? ["Alta","alta"] : s >= 9 ? ["Media","media"] : ["Baja","baja"];
}
function openDetail(id){
  const r = findReport(id); if (!r) return;
  clearPick();
  state.sel = id; renderPins();
  const o = getObra(id);
  const [pl, pc] = priority(r);
  const stIdx = ["recibida","en_proceso","resuelta"].indexOf(r.status);
  const src = r.demo ? '<span class="chip">Dato de ejemplo</span>' : Store.mode === "supabase" ? '<span class="chip">Denuncia ciudadana</span>' : '<span class="chip">Modo de prueba</span>';
  let obraHtml = "";
  if (o){
    const ref = refCost(o, r), dev = (o.monto - ref.total)/ref.total;
    obraHtml = `<div class="card" style="padding:12px;gap:8px">
      <div class="eyebrow">Obra municipal asignada</div>
      <dl class="kv"><dt>Contratista</dt><dd>${esc(o.contratista)}</dd><dt>Responsable</dt><dd>${esc(o.responsable)}</dd><dt>Fecha prevista</dt><dd>${fmtDate(o.fecha)}</dd><dt>Monto declarado</dt><dd class="mono">${fmtGs(o.monto)}</dd><dt>Costo de referencia</dt><dd class="mono">${fmtGs(ref.total)}</dd></dl>
      ${flagHtml(dev)}
      <button class="btn small" type="button" data-goto-obra="${esc(id)}">Ver detalle en el panel municipal</button>
    </div>`;
  } else if (["bache","semaforo","alumbrado","inundacion","basura"].includes(r.cat)) {
    obraHtml = `<div class="note">Todavía no hay obra municipal asignada.</div>`;
  }
  const muniBtns = state.staff ? `<div class="card" style="padding:12px;gap:8px"><div class="eyebrow">${state.muni ? "Acciones municipales" : "Moderación"}</div>
      <div class="rowbtns">${r.mod!=="verificada"?`<button class="btn small" data-mod="verificada" type="button">✓ Verificar</button>`:""}${r.mod!=="falsa"?`<button class="btn small flag-btn" data-mod="falsa" type="button">✕ Marcar como falsa</button>`:""}${r.mod?`<button class="btn small" data-mod="" type="button">Quitar marca</button>`:""}</div>
      ${state.muni ? `<div class="rowbtns">${r.status!=="en_proceso"?`<button class="btn small" data-status="en_proceso" type="button">Marcar en proceso</button>`:""}${r.status!=="resuelta"?`<button class="btn small" data-status="resuelta" type="button">Marcar resuelta</button>`:""}
      ${!o && ["bache","semaforo","alumbrado","inundacion","basura"].includes(r.cat) ? `<button class="btn small primary" data-new-obra="${esc(id)}" type="button">Asignar obra</button>`:""}</div>` : ""}</div>` : "";
  showDrawer(`
    <div class="rd-head">
      <div class="rd-mark" style="--c:${cvar(r.cat)}" aria-hidden="true">${ICONS[r.cat]}</div>
      <div class="rd-title"><h2>${CATS[r.cat].one}</h2><p><span class="mono">${esc(r.id)}</span> · ${esc(r.barrio)}</p></div>
      <button class="x" type="button" aria-label="Cerrar" data-close>×</button>
    </div>
    <div class="drawer-body">
      <div class="rowbtns"><span class="chip c" style="--c:${cvar(r.cat)}">${esc(r.barrio)}</span><span class="chip">${ago(r.t)}</span>${state.near.c ? `<span class="chip">a ${fmtDist(distM(state.near.c,[r.lat,r.lng]))} de vos</span>` : ""}${src}${modChip(r)}</div>
      ${photoBlock(r)}
      <p style="margin:0;font-size:15px">${esc(r.desc)}</p>
      <div class="steps">${["Recibida","En proceso","Resuelta"].map((s,i)=>`<span class="${i<=stIdx?"done":""}">${s}</span>`).join("")}</div>
      <div class="ai">
        <span class="ai-tag sim">Prioridad calculada</span>
        <div>Prioridad <b class="prio-${pc}">${pl}</b> · gravedad ${r.sev||3}/5 · ${r.votes||0} vecinos lo confirmaron</div>
      </div>
      <div class="rowbtns">
        <button class="btn" type="button" data-vote="${esc(r.id)}" aria-pressed="${!!mine[r.id+":v"]}">👁 Yo también lo vi · ${r.votes||0}</button>
        <button class="btn flag-btn" type="button" data-flag="${esc(r.id)}" aria-pressed="${!!mine[r.id+":f"]}">⚑ Parece falsa${r.flags ? " · " + r.flags : ""}</button>
      </div>
      ${obraHtml}
      ${muniBtns}
      <div class="note mono">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)} · ${new Date(r.t).toLocaleString("es-PY")}</div>
    </div>`);
}
function modChip(r){
  if (r.mod==="verificada") return '<span class="chip ok">✓ Verificada por la municipalidad</span>';
  if (r.mod==="falsa") return '<span class="chip bad">✕ Marcada como falsa</span>';
  if ((r.flags||0) >= 3 && (r.flags||0) > (r.votes||0)) return '<span class="chip warn">⚑ En revisión</span>';
  return "";
}
// Enlace al original en calidad completa: solo la moderación y la municipalidad, con un enlace temporal.
function origLink(r){
  return r.photoOrig && state.staff ? `<button class="lnk note" type="button" data-orig="${esc(r.id)}" style="align-self:flex-start">Ver foto original en calidad completa</button>` : "";
}
function photoBlock(r){
  if (!hasPhoto(r)) return `<div class="nophoto">Esta denuncia no tiene foto. Las denuncias con foto se verifican más rápido.</div>`;
  const url = Store.photoUrl(r);
  const taken = r.photoTaken ? `<div class="note">Foto tomada ${ago(r.photoTaken)}${r.photoTaken < r.t - 3*DAY ? ` · <b style="color:var(--warn)">es ${Math.round((r.t-r.photoTaken)/DAY)} días anterior a la denuncia, podría ser reutilizada</b>` : ""}</div>` : "";
  return `<div class="ph" id="dPhoto"><img src="${esc(url)}" alt="Foto de la denuncia" data-zoom data-alt="${esc(Store.photoUrl(r, true))}"><span class="ph-zoom">Tocá para ampliar</span></div>${origLink(r)}${taken}`;
}
// Si la copia liviana se guardó como JPEG (celulares que no generan WebP), se prueba esa extensión.
document.addEventListener("error", e => {
  const im = e.target; if (!(im instanceof HTMLImageElement) || !im.dataset.alt || im.dataset.tried) return;
  im.dataset.tried = "1"; if (im.dataset.alt !== im.src) im.src = im.dataset.alt; else im.closest(".ph").innerHTML = `<div class="ph-load">No se pudo cargar la foto.</div>`;
}, true);
const lightbox = $("#lightbox");
function openLightbox(src){ lightbox.querySelector("img").src = src; lightbox.hidden = false; }
lightbox.addEventListener("click", () => { lightbox.hidden = true; lightbox.querySelector("img").removeAttribute("src"); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !lightbox.hidden) lightbox.click(); });
drawer.addEventListener("click", async e => {
  if (e.target.closest("[data-close]")) return closeDrawer();
  const z = e.target.closest("[data-zoom]"); if (z) return openLightbox(z.src);
  const og = e.target.closest("[data-orig]");
  if (og){ og.disabled = true; try { window.open(await Store.originalUrl(findReport(og.dataset.orig)), "_blank", "noopener"); } catch(err){ toast(err.message || "No se pudo abrir el original."); } og.disabled = false; return; }
  const v = e.target.closest("[data-vote]");
  if (v) return vote(v.dataset.vote, "confirma");
  const f = e.target.closest("[data-flag]");
  if (f) return vote(f.dataset.flag, "falsa");
  const md = e.target.closest("[data-mod]");
  if (md){ const r = findReport(state.sel); const m = md.dataset.mod; if (!await patchReport(r, {mod:m})) return; toast(m==="falsa" ? "Marcada como falsa: ya no aparece en el mapa público." : m ? "Denuncia verificada." : "Marca quitada."); if (m==="falsa") return closeDrawer(); return openDetail(r.id); }
  const s = e.target.closest("[data-status]");
  if (s){ const r = findReport(state.sel); if (!await patchReport(r, {status:s.dataset.status})) return; toast("Estado actualizado."); return openDetail(r.id); }
  const g = e.target.closest("[data-goto-obra]"); if (g){ location.hash = "municipalidad"; setTimeout(()=>openObraEditor(g.dataset.gotoObra), 60); return; }
  const n = e.target.closest("[data-new-obra]"); if (n){ location.hash = "municipalidad"; setTimeout(()=>openObraEditor(n.dataset.newObra, true), 60); return; }
  if (e.target.closest("#btnAnalyze")) return analyze();
  if (e.target.closest("#btnFormLogin")) return openLogin();
  if (e.target.closest("#btnPick")) { pickMode = true; $("#pickBanner").hidden = false; if (MOBILE.matches) document.body.classList.add("picking"); return; }
  if (e.target.closest("#btnNotDup")) { formState.ignoreDup = true; checkDuplicate(); return; }
});
// Cambios de estado o moderación: los aplica la base, que valida el rol y deja constancia en el historial.
async function patchReport(r, patch){
  try { Object.assign(r, await Store.updateReport(r.id, patch)); refresh(); return true; }
  catch(err){ toast("No se pudo guardar: " + (err.message || err)); return false; }
}
// "Yo también lo vi" y "Parece falsa": uno por persona; la base lo controla aunque se borre el navegador.
async function vote(id, kind){
  const r = findReport(id); if (!r) return;
  const k = kind === "confirma" ? "v" : "f";
  if (mine[id+":"+k]) { toast(kind === "confirma" ? "Ya confirmaste esta denuncia." : "Ya avisaste que esta denuncia parece falsa."); return; }
  try {
    const total = await Store.vote(id, kind);
    markMine(id, k);
    if (total == null) { toast("Ya lo habías marcado antes."); return openDetail(id); }
    if (kind === "confirma") r.votes = total; else r.flags = total;
    toast(kind === "confirma" ? "Gracias. Tu confirmación sube la prioridad." : "Gracias. La moderación la va a revisar.");
    refresh(); openDetail(id);
  } catch(err){ toast(err.message || "No se pudo registrar."); if (err.needLogin) openLogin(); }
}

/* ---------- Cajón: nueva denuncia ---------- */
const formState = {photo:null, photoBlob:null, photoFile:null, photoTaken:null, ai:null, dup:null, ignoreDup:false};
function openForm(){
  location.hash = "mapa";
  state.sel = null; renderPins();
  Object.assign(formState, {photo:null, photoBlob:null, photoFile:null, photoTaken:null, ai:null, dup:null, ignoreDup:false});
  showDrawer(`
    <div class="drawer-head"><div><div class="eyebrow">Nueva denuncia</div><h2>¿Qué está pasando?</h2></div><button class="x" type="button" aria-label="Cerrar" data-close>×</button></div>
    <form class="drawer-body" id="reportForm" novalidate>
      <div class="field"><span class="lab">Foto del problema (recomendada)</span><div class="ph-btns"><label class="inp ph-pick" for="fCam">Sacar foto</label><label class="inp ph-pick" for="fPhoto">Elegir de la galería</label></div><input type="file" id="fCam" accept="image/*" capture="environment" hidden><input type="file" id="fPhoto" accept="image/*" hidden><small>Los vecinos la ven al tocar el pin y ayuda a distinguir denuncias reales de falsas. Se envía una copia liviana para el mapa y el original queda guardado en calidad completa, visible solo para la moderación.</small><div class="ph-prev" id="fPrev" hidden><img class="thumb" id="fThumb" alt="Vista previa"><button class="ph-x" type="button" id="fPhotoX" aria-label="Descartar foto" title="Descartar foto">×</button></div><small id="fPhotoInfo"></small></div>
      <div class="field"><label for="fDesc">Descripción</label><textarea class="inp" id="fDesc" placeholder="Ej.: Pozo grande frente a la parada, ya reventó dos cubiertas" required></textarea></div>
      <div class="field"><span class="lab">Ubicación</span><div id="fLoc" class="note">Sin marcar todavía.</div><button class="btn small" id="btnPick" type="button" style="align-self:flex-start">Marcar en el mapa</button></div>
      <div class="grid2">
        <div class="field"><label for="fCat">Categoría</label><select class="inp" id="fCat"><option value="">Automática</option>${CAT_KEYS.map(k=>`<option value="${k}">${CATS[k].one}</option>`).join("")}</select></div>
        <div class="field"><label for="fSev">Gravedad</label><select class="inp" id="fSev"><option value="">Automática</option>${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join("")}</select></div>
      </div>
      <button class="btn" type="button" id="btnAnalyze">Sugerir categoría</button>
      <div id="aiOut"></div>
      <div id="dupOut"></div>
      <button class="btn primary" type="submit" id="btnSend">Enviar denuncia</button>
      <div class="note" id="sendNote"></div>
    </form>`);
  pickMode = true; $("#pickBanner").hidden = false;
  setPick(map.getCenter() && [map.getCenter().lat, map.getCenter().lng]);
  pickMode = true; $("#pickBanner").hidden = false;
  $("#sendNote").innerHTML = Store.mode === "supabase"
    ? `Se publica al instante para todos. No hace falta registrarse${Store.user && !Store.user.anon ? "" : `; si preferís, <button class="lnk" type="button" id="btnFormLogin">ingresá con tu email</button>`}.`
    : "Modo de prueba: la denuncia se ve en este navegador y se pierde al recargar.";
  const onPhoto = async e => {
    const f = e.target.files[0]; if (!f) return;
    $("#fPhotoInfo").textContent = "Preparando foto…";
    const ph = await compressPhoto(f);
    if (!ph){ $("#fPhotoInfo").textContent = "No se pudo leer esa imagen. Probá con otra."; return; }
    Object.assign(formState, {photo:ph.dataUrl, photoBlob:ph.blob, photoFile:f, photoTaken:Math.min(f.lastModified || Date.now(), Date.now())});
    $("#fThumb").src = ph.dataUrl; $("#fPrev").hidden = false;
    $("#fPhotoInfo").textContent = `Lista para enviar · copia para el mapa ${ph.w}×${ph.h} px, ${ph.fmt} ${Math.round(ph.blob.size/1024)} KB · original ${Math.round(f.size/1024)} KB se guarda intacto`;
  };
  // "Sacar foto" abre la cámara del celular; en computadora abre el selector de archivos.
  $("#fCam").addEventListener("change", onPhoto);
  $("#fPhoto").addEventListener("change", onPhoto);
  // La X descarta la foto tomada para poder sacar otra o enviar sin foto.
  $("#fPhotoX").addEventListener("click", () => {
    Object.assign(formState, {photo:null, photoBlob:null, photoFile:null, photoTaken:null});
    $("#fCam").value = ""; $("#fPhoto").value = "";
    $("#fThumb").removeAttribute("src"); $("#fPrev").hidden = true;
    $("#fPhotoInfo").textContent = "Foto descartada.";
  });
  $("#fCat").addEventListener("change", checkDuplicate);
  $("#reportForm").addEventListener("submit", submitReport);
}
$("#btnNew").addEventListener("click", openForm);
$("#btnNewM").addEventListener("click", openForm);
const side = $(".side");
// Computadora: plegar o desplegar el panel "Explorar" (se recuerda en este navegador).
function setSideCollapsed(c){
  $("#view-mapa").classList.toggle("side-collapsed", c);
  const b = $("#btnSideToggle"); b.setAttribute("aria-expanded", !c);
  b.setAttribute("aria-label", c ? "Mostrar panel Explorar" : "Ocultar panel Explorar"); b.title = c ? "Mostrar panel" : "Ocultar panel";
  try { localStorage.setItem(MOBILE.matches ? "cde-side-collapsed-m" : "cde-side-collapsed", c ? "1" : "0"); } catch(e) {}
}
$("#btnSideToggle").addEventListener("click", () => setSideCollapsed(!$("#view-mapa").classList.contains("side-collapsed")));
// En el celular arranca cerrado para dejar ver el mapa, salvo que la persona lo haya dejado abierto.
{ let s = null; try { s = localStorage.getItem(MOBILE.matches ? "cde-side-collapsed-m" : "cde-side-collapsed"); } catch(e) {} if (MOBILE.matches ? s !== "0" : s === "1") setSideCollapsed(true); }
function setSide(open){ if (MOBILE.matches){ if (open === $("#view-mapa").classList.contains("side-collapsed")) setSideCollapsed(!open); return; } side.classList.toggle("open", open); $("#btnSide").setAttribute("aria-expanded", open); if (!open) side.scrollTop = 0; }
$("#btnSide").addEventListener("click", () => setSide(!side.classList.contains("open")));
$("#btnSideClose").addEventListener("click", () => setSide(false));
side.querySelector(".sheet-head").addEventListener("click", e => { if (MOBILE.matches && !side.classList.contains("open") && !e.target.closest("button")) setSide(true); });

/* ---------- Filtros: tipo de peligro y cercanía ---------- */
const PRESETS = {seguridad:["asalto","inseguro"], via:["bache","semaforo","alumbrado"], ambiente:["inundacion","basura","animal"]};
const RADII = [500, 1000, 2000, 5000];
const fpanel = $("#fpanel");
let nearLayer = null, nearPicking = false;
function setFilters(open){
  fpanel.hidden = !open; $("#btnFilters").setAttribute("aria-expanded", open);
  if (open){ drawer.hidden || closeDrawer(); setSide(false); renderFilterUI(); }
}
$("#btnFilters").addEventListener("click", () => setFilters(fpanel.hidden));
$("#fClose").addEventListener("click", () => setFilters(false));
$("#fApply").addEventListener("click", () => { setFilters(false); if (nearActive()) fitNear(); });
function renderFilterUI(){
  const n = (CAT_KEYS.length - state.cats.size ? 1 : 0) + (nearActive() ? 1 : 0) + (state.onlyPhoto ? 1 : 0) + (!state.showRes ? 1 : 0);
  $("#fBadge").hidden = !n; $("#fBadge").textContent = n;
  const nc = $("#nearChip"); nc.hidden = !nearActive();
  if (nearActive()) nc.innerHTML = `A menos de ${fmtDist(state.near.r)} <span class="xx" aria-hidden="true">×</span>`, nc.setAttribute("aria-label", `Quitar filtro de cercanía de ${fmtDist(state.near.r)}`);
  if (fpanel.hidden) return;
  const inP = allReports().filter(r => inPeriod(r) && nearOK(r));
  $("#ftypes").innerHTML = CAT_KEYS.map(k => `<label class="ftype"><span class="dot" style="--c:${cvar(k)}">${ICONS[k]}</span><span>${CATS[k].n}</span><span class="n">${inP.filter(r=>r.cat===k).length}</span><input type="checkbox" data-ft="${k}" ${state.cats.has(k)?"checked":""}></label>`).join("");
  $$("#presets [data-preset]").forEach(b => { const ks = PRESETS[b.dataset.preset]; b.setAttribute("aria-pressed", state.cats.size === ks.length && ks.every(k => state.cats.has(k))); });
  $("#nearOn").checked = state.near.on;
  $("#nearR").innerHTML = RADII.map(r => `<button type="button" data-r="${r}" aria-pressed="${state.near.r===r}">${fmtDist(r)}</button>`).join("");
}
$("#ftypes").addEventListener("change", e => { const k = e.target.dataset.ft; if (!k) return; e.target.checked ? state.cats.add(k) : state.cats.delete(k); refresh(); });
$("#presets").addEventListener("click", e => { const b = e.target.closest("[data-preset]"); if (!b) return; state.cats = new Set(PRESETS[b.dataset.preset]); refresh(); });
$("#fAll").addEventListener("click", () => { state.cats = new Set(CAT_KEYS); refresh(); });
$("#fNone").addEventListener("click", () => { state.cats = new Set(); refresh(); });
$("#fReset").addEventListener("click", () => {
  state.cats = new Set(CAT_KEYS); state.onlyPhoto = false; state.showRes = true; $("#tgPhoto").checked = false; $("#tgRes").checked = true;
  setNearOn(false); refresh();
});
function nearStatus(text, cls=""){ const el = $("#nearStatus"); el.textContent = text; el.className = "near-status " + cls; }
function drawNear(){
  if (nearLayer){ map.removeLayer(nearLayer); nearLayer = null; }
  if (!state.near.c) return;
  nearLayer = L.layerGroup([
    ...(state.near.on ? [L.circle(state.near.c, {radius:state.near.r, className:"lf-near", interactive:false})] : []),
    L.marker(state.near.c, {keyboard:false, interactive:false, zIndexOffset:900, icon:L.divIcon({className:"", html:'<div class="me-dot"></div>', iconSize:[18,18], iconAnchor:[9,9]})})
  ]).addTo(map);
}
function fitNear(){ if (state.near.c) map.flyToBounds(L.latLng(state.near.c).toBounds(state.near.r*2.3), {duration:.6, paddingTopLeft: MOBILE.matches || $("#view-mapa").classList.contains("side-collapsed") ? [0,0] : [400,0]}); }
function setNearCenter(c, src){
  nearPicking = false; $("#nearBanner").hidden = true; document.body.classList.remove("nearpicking");
  state.near.c = c; state.near.src = src; state.near.on = true;
  nearStatus(src === "gps" ? `Usando tu ubicación (${nearestBarrio(c)}).` : `Usando el punto que marcaste (${nearestBarrio(c)}).`, "ok");
  drawNear(); refresh(); fitNear();
  if (src === "mapa" && fpanel.hidden) toast(`Mostrando denuncias a menos de ${fmtDist(state.near.r)}.`);
}
function setNearOn(on){
  state.near.on = on;
  if (on && !state.near.c){ locate(); return; }
  if (!on) nearStatus("Mostrá solo las denuncias cerca de donde estás.");
  drawNear(); refresh();
}
function locate(){
  if (!navigator.geolocation){ nearStatus("Este navegador no comparte la ubicación. Marcá tu punto en el mapa.", "bad"); state.near.on = false; refresh(); return; }
  nearStatus("Buscando tu ubicación…");
  navigator.geolocation.getCurrentPosition(pos => {
    const c = [pos.coords.latitude, pos.coords.longitude];
    if (!L.latLngBounds(SAT_BOUNDS).contains(c)){ state.near.on = false; nearStatus("Parece que no estás en Ciudad del Este. Marcá un punto en el mapa para probar.", "bad"); refresh(); return; }
    setNearCenter(c, "gps");
  }, err => {
    state.near.on = false; refresh();
    nearStatus(err.code === 1 ? "No se dio permiso para usar la ubicación. Podés marcar tu punto en el mapa." : "No se pudo obtener la ubicación. Podés marcar tu punto en el mapa.", "bad");
  }, {enableHighAccuracy:true, timeout:10000, maximumAge:60000});
}
$("#nearOn").addEventListener("change", e => setNearOn(e.target.checked));
$("#nearGps").addEventListener("click", locate);
$("#nearPickBtn").addEventListener("click", () => {
  nearPicking = true; setFilters(false); $("#nearBanner").hidden = false;
  if (MOBILE.matches) document.body.classList.add("nearpicking");
});
$("#nearBannerX").addEventListener("click", e => { e.stopPropagation(); nearPicking = false; $("#nearBanner").hidden = true; document.body.classList.remove("nearpicking"); setFilters(true); });
$("#nearR").addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (!b) return; state.near.r = +b.dataset.r; if (state.near.c) state.near.on = true; drawNear(); refresh(); if (nearActive()) fitNear(); });
$("#nearChip").addEventListener("click", () => setNearOn(false));

/* ---------- Menú, capas y buscador (versión minimalista) ---------- */
const menu = $("#menu"), scrim = $("#menuScrim");
function setMenu(open){ menu.classList.toggle("open", open); scrim.hidden = !open; $("#btnMenu").setAttribute("aria-expanded", open); }
$("#btnMenu").addEventListener("click", () => setMenu(true));
scrim.addEventListener("click", () => setMenu(false));
menu.addEventListener("click", e => { if (e.target.closest("a,button")) setMenu(false); });
const layersPop = $("#layersPop");
function setLayers(open){ layersPop.hidden = !open; $("#btnLayers").setAttribute("aria-expanded", open); }
$("#btnLayers").addEventListener("click", e => { e.stopPropagation(); setLayers(layersPop.hidden); });
document.addEventListener("click", e => { if (!layersPop.hidden && !e.target.closest("#layersPop,#btnLayers")) setLayers(false); if (!qres.hidden && !e.target.closest(".searchbox")) qres.hidden = true; });
$("#btnRecenter").addEventListener("click", () => map.flyTo(MOBILE.matches ? [-25.51,-54.625] : [-25.512,-54.638], MOBILE.matches ? 13 : 13.5, {duration:.6}));
const qIn = $("#q"), qres = $("#qres");
const norm = t => String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function runSearch(){
  const s = norm(qIn.value.trim());
  if (!s){ qres.hidden = true; return; }
  const bs = BARRIOS.filter(b => norm(b.n).includes(s)).slice(0,4)
    .map(b => `<button type="button" data-b="${esc(b.n)}"><span class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.4"/></svg></span><span><b>${esc(b.n)}</b><small>Barrio · ${allReports().filter(r=>r.barrio===b.n && inPeriod(r)).length} denuncias en el período</small></span></button>`);
  const rs = allReports().filter(r => norm(r.id).includes(s) || norm(r.barrio).includes(s) || norm(r.desc).includes(s) || norm(CATS[r.cat].one).includes(s) || norm(CATS[r.cat].n).includes(s))
    .sort((a,b) => b.t-a.t).slice(0,6)
    .map(r => `<button type="button" data-r="${esc(r.id)}"><span class="ri c" style="--c:${cvar(r.cat)}">${ICONS[r.cat]}</span><span><b>${CATS[r.cat].one} · ${esc(r.barrio)}</b><small>${esc(r.desc)} · ${ago(r.t)}</small></span></button>`);
  qres.innerHTML = [...bs, ...rs].join("") || `<div class="empty">Sin resultados para “${esc(qIn.value.trim())}”.</div>`;
  qres.hidden = false;
}
qIn.addEventListener("input", runSearch);
qIn.addEventListener("focus", () => { if (qIn.value.trim()) runSearch(); });
qIn.addEventListener("keydown", e => { if (e.key === "Escape"){ qIn.value = ""; qres.hidden = true; qIn.blur(); } if (e.key === "Enter"){ const f = qres.querySelector("button"); if (f) f.click(); } });
qres.addEventListener("click", e => {
  const b = e.target.closest("[data-b]"), r = e.target.closest("[data-r]");
  if (b){ const x = BARRIOS.find(z => z.n === b.dataset.b); if (x){ setSide(false); map.flyTo(x.c, 15.5, {duration:.6}); } }
  if (r){ const x = findReport(r.dataset.r); if (x){ setSide(false); map.flyTo([x.lat,x.lng], 16.5, {duration:.6}); openDetail(x.id); } }
  qres.hidden = true; qIn.blur();
});
$("#btnPickDone").addEventListener("click", e => { e.stopPropagation(); pickMode = false; document.body.classList.remove("picking"); $("#pickBanner").hidden = true; });
// Comprime la foto en el teléfono para el mapa: WebP (JPEG si el navegador no lo soporta) a 1280 px con calidad alta,
// que en pantalla se ve igual al original. Solo baja de tamaño si pasa de ~190 KB, así el mapa carga rápido.
// El archivo original, sin tocar, se sube aparte al almacén privado para la moderación.
const WEBP = (() => { try { const c = document.createElement("canvas"); c.width = c.height = 1; return c.toDataURL("image/webp").startsWith("data:image/webp"); } catch(e){ return false; } })();
async function compressPhoto(file){
  let bmp = null;
  try { bmp = await createImageBitmap(file, {imageOrientation:"from-image"}); } catch(e) {}
  if (!bmp) { const u = await downscale(file, 1080); if (!u) return null; const b = await (await fetch(u)).blob(); const i = new Image(); i.src = u; await i.decode().catch(()=>{}); return {dataUrl:u, blob:b, w:i.naturalWidth, h:i.naturalHeight, fmt:b.type === "image/webp" ? "WebP" : "JPEG"}; }
  const type = WEBP ? "image/webp" : "image/jpeg", steps = [[1280,.85],[1080,.8],[960,.75],[720,.7]];
  for (const [max, q] of steps){
    const s = Math.min(1, max/Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
    c.width = Math.round(bmp.width*s); c.height = Math.round(bmp.height*s);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL(type, q);
    if (dataUrl.length < 190000 || max === 720){ const blob = await (await fetch(dataUrl)).blob(); bmp.close?.(); return {dataUrl, blob, w:c.width, h:c.height, fmt:WEBP ? "WebP" : "JPEG"}; }
  }
}
function downscale(file, max){
  return new Promise(res => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const s = Math.min(1, max/Math.max(im.width, im.height)); const c = document.createElement("canvas"); c.width = Math.round(im.width*s); c.height = Math.round(im.height*s); c.getContext("2d").drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL(WEBP ? "image/webp" : "image/jpeg", .8)); };
    im.onerror = () => { URL.revokeObjectURL(url); res(null); };
    im.src = url;
  });
}
const KW = {
  bache:/bache|pozo|hundim|asfalto|cubierta|calzada|hoyo/i, inundacion:/inund|agua|raudal|desag|lluvia|anega/i,
  animal:/perro|gato|caballo|vaca|animal|muert|atropell/i, semaforo:/sem[aá]foro|luz verde|luz roja|intermitente/i,
  asalto:/asalt|rob|arrebat|motochorro|arma|cartera|celular/i, inseguro:/insegur|oscur|peligro|droga|miedo|baldío/i,
  basura:/basura|vertedero|residuo|contenedor|quema|desperdicio/i, alumbrado:/alumbrado|foco|columna|luminaria|sin luz|poste/i
};
// Clasificación por palabras clave: sugiere categoría y gravedad sin enviar la descripción a ningún servicio externo.
function classify(desc){
  let best = "bache", bs = 0;
  for (const [k,re] of Object.entries(KW)){ const m = (desc.match(new RegExp(re.source,"gi"))||[]).length; if (m > bs){ bs = m; best = k; } }
  const sev = /arma|herid|peligro|profundo|casas|choque|niñ|escuela/i.test(desc) ? 5 : /grande|todo|hora pico|semana/i.test(desc) ? 4 : 3;
  return {categoria:best, gravedad:sev, area_m2: best==="bache" ? (sev>=4?2.4:1.2) : null, confianza: bs ? Math.min(.9, .55+bs*.15) : .4, src:"palabras"};
}
function analyze(){
  const desc = $("#fDesc").value.trim();
  if (!desc){ toast("Escribí una descripción para sugerir la categoría."); $("#fDesc").focus(); return; }
  const res = classify(desc); formState.ai = res;
  if (!$("#fCat").value) $("#fCat").value = res.categoria;
  if (!$("#fSev").value) $("#fSev").value = String(res.gravedad);
  $("#aiOut").innerHTML = `<div class="ai"><span class="ai-tag sim">Sugerencia automática</span><div><b>${CATS[res.categoria].one}</b> · gravedad ${res.gravedad}/5</div><div class="note">Sale de las palabras de tu descripción. Cambiala arriba si no corresponde.</div></div>`;
  checkDuplicate();
}
function checkDuplicate(){
  const out = $("#dupOut"); if (!out) return;
  const cat = $("#fCat")?.value || formState.ai?.categoria;
  formState.dup = null;
  if (!cat || !pickLatLng || formState.ignoreDup){ out.innerHTML = ""; return; }
  const near = allReports().filter(r => r.cat===cat && r.status!=="resuelta" && Date.now()-r.t < 21*DAY)
    .map(r => ({r, d:distM(pickLatLng, [r.lat,r.lng])})).filter(x => x.d < 120).sort((a,b)=>a.d-b.d)[0];
  if (!near){ out.innerHTML = ""; return; }
  formState.dup = near.r;
  out.innerHTML = `<div class="warnbox"><b>Posible denuncia repetida.</b> Ya hay un reporte de ${CATS[cat].one.toLowerCase()} a ${Math.round(near.d)} m (${esc(near.r.id)}, ${ago(near.r.t)}). Si enviás, se suma como confirmación y sube su prioridad.
    <div class="rowbtns" style="margin-top:8px"><button class="btn small" type="button" id="btnNotDup">Es otro problema distinto</button></div></div>`;
}
async function submitReport(e){
  e.preventDefault();
  const desc = $("#fDesc").value.trim();
  if (desc.length < 3){ toast("Agregá una descripción breve."); $("#fDesc").focus(); return; }
  if (!pickLatLng){ toast("Marcá la ubicación en el mapa."); return; }
  if (!$("#fCat").value && !formState.ai) analyze();
  const cat = $("#fCat").value || formState.ai?.categoria || "bache";
  if (formState.dup && !formState.ignoreDup){
    const r = formState.dup; clearPick(); openDetail(r.id); await vote(r.id, "confirma"); return;
  }
  const ai = formState.ai || classify(desc);
  const rec = {cat, lat:+pickLatLng[0].toFixed(5), lng:+pickLatLng[1].toFixed(5), desc:desc.slice(0,500), barrio:nearestBarrio(pickLatLng),
    sev:+($("#fSev").value || ai.gravedad || 3), ai:{src:ai.src, conf:ai.confianza, area_m2:ai.area_m2||null}, photoTaken:formState.photo ? formState.photoTaken : null};
  const btn = $("#btnSend"); btn.disabled = true; btn.textContent = "Enviando…";
  try {
    const {report, warn} = await Store.createReport(rec, formState.photo ? {blob:formState.photoBlob, dataUrl:formState.photo, file:formState.photoFile} : null);
    live.set(report.id, report);
    clearPick(); refresh(); openDetail(report.id);
    toast(warn || "Denuncia enviada. ¡Gracias por avisar!");
  } catch(err){
    btn.disabled = false; btn.textContent = "Enviar denuncia";
    toast(err.message || "No se pudo enviar la denuncia.");
    if (err.needLogin) openLogin();
  }
}

/* ---------- Obras municipales y costo de referencia ---------- */
const PARAMS_DEFAULT = {
  asfalto:{n:"Mezcla asfáltica en caliente (Gs/m³)", v:2200000},
  liga:{n:"Riego de liga (Gs/m²)", v:9000},
  hora:{n:"Mano de obra (Gs/hora, con cargas)", v:18500},
  camion:{n:"Camión volquete (Gs/hora)", v:250000},
  rodillo:{n:"Rodillo compactador (Gs/hora)", v:180000},
  diesel:{n:"Diésel tipo III (Gs/litro)", v:7050},
  consumo:{n:"Consumo camión (litros/km)", v:.35},
  gg:{n:"Gastos generales y utilidad (%)", v:15},
  mat_semaforo:{n:"Módulo semafórico LED (Gs)", v:3800000},
  mat_alumbrado:{n:"Luminaria LED 100 W (Gs)", v:1350000},
  mat_otro:{n:"Materiales varios (Gs)", v:900000},
};
const params = JSON.parse(JSON.stringify(PARAMS_DEFAULT));
const CONTRATISTAS = ["Constructora Paraná S.A.","Vialtec del Este S.R.L.","Asfaltos Alto Paraná","Servicios Viales Monday","Electro Sur Ingeniería"];
const RESPONSABLES = ["Ing. A. Martínez · Obras Públicas","Arq. L. Giménez · Planificación Urbana","Ing. C. Duarte · Mantenimiento Vial","Lic. M. Ortiz · Servicios Urbanos"];
const fmtDate = s => s ? new Date(s+"T12:00:00").toLocaleDateString("es-PY",{day:"numeric",month:"short",year:"numeric"}) : "—";
const getObra = id => obrasLive.get(id);
const allObras = () => [...obrasLive.values()].filter(o => { const r = findReport(o.reportId); return r && r.mod !== "falsa" && (state.showDemo || !r.demo); });
function refCost(o, r){
  const P = k => +params[k].v;
  const tipo = r?.cat || o.tipo || "bache";
  let mat = 0, matLbl = "";
  if (tipo==="bache"){ const vol = (+o.m2||1)*(+o.prof||.07)*1.1; mat = vol*P("asfalto") + (+o.m2||1)*P("liga"); matLbl = `Asfalto ${vol.toFixed(2)} m³ + riego de liga`; }
  else if (tipo==="semaforo"){ mat = P("mat_semaforo"); matLbl = "Módulo semafórico LED"; }
  else if (tipo==="alumbrado"){ mat = P("mat_alumbrado") * (+o.unidades||1); matLbl = `Luminarias LED × ${o.unidades||1}`; }
  else { mat = P("mat_otro"); matLbl = "Materiales varios"; }
  const mo = (+o.personas||0)*(+o.horas||0)*P("hora");
  const veh = (+o.horasVeh||0)*(P("camion") + (tipo==="bache" ? P("rodillo") : 0));
  const km = r ? distM(DEPOT, [r.lat, r.lng])/1000*1.35*2 : 6;
  const fuel = km*P("consumo")*P("diesel")*(+o.viajes||1);
  const sub = mat+mo+veh+fuel, gg = sub*P("gg")/100;
  return {mat, matLbl, mo, veh, km, fuel, gg, total: sub+gg};
}
function flagHtml(dev){
  const pct = Math.round(dev*100);
  if (dev > .3) return `<div class="badbox"><b>Alerta de posible sobrefacturación.</b> El monto declarado supera en ${pct}% el costo de referencia calculado por la IA.</div>`;
  if (dev > .15) return `<div class="warnbox"><b>Revisar.</b> El monto declarado está ${pct}% por encima de la referencia.</div>`;
  return `<div class="okbox"><b>Monto razonable.</b> Diferencia de ${pct>0?"+":""}${pct}% con la referencia.</div>`;
}
const flagChip = dev => dev > .3 ? `<span class="flag bad">▲ +${Math.round(dev*100)}% alerta</span>` : dev > .15 ? `<span class="flag warn">+${Math.round(dev*100)}% revisar</span>` : `<span class="flag ok">${dev>0?"+":""}${Math.round(dev*100)}% ok</span>`;

/* Historial con huella encadenada: la calcula la base (SHA-256) y cualquiera puede verificar la cadena. */
function renderAudit(){
  const rows = auditLive.filter(e => state.showDemo || !e.demo).slice().reverse();
  $("#audit").innerHTML = rows.map(e => `<div><b>${esc(e.action)}</b><br>${esc(e.detail)}<br><span class="note">${new Date(e.t).toLocaleString("es-PY")} · ${esc(e.who)}</span><br><span class="h">huella ${esc(String(e.h).slice(0,12))} ← ${esc(String(e.prev).slice(0,12))}</span></div>`).join("") || `<div class="empty">Sin cambios registrados.</div>`;
}
$("#btnVerify").addEventListener("click", async () => {
  const out = $("#verifyOut"); out.textContent = "Verificando…"; out.className = "note";
  try {
    const bad = await Store.verifyAudit();
    out.textContent = bad.length ? `⚠ ${bad.length} registro(s) no coinciden con su huella: ${bad.slice(0,5).map(b => "#" + b.id + " (" + b.motivo + ")").join(", ")}` : `✓ Cadena íntegra: los ${auditLive.length} registros coinciden con sus huellas.`;
    out.style.color = bad.length ? "var(--bad)" : "var(--ok)";
  } catch(err){ out.textContent = "No se pudo verificar: " + (err.message || err); }
});

function renderParams(){
  $("#params").innerHTML = Object.entries(params).sort((a,b) => (a[1].o||0)-(b[1].o||0)).map(([k,p]) => `<label for="p_${k}">${esc(p.n)}</label><input class="inp mono" id="p_${k}" data-param="${k}" type="number" step="any" value="${p.v}" ${state.muni?"":"disabled"}>`).join("");
}
$("#params").addEventListener("change", e => {
  const k = e.target.dataset.param; if (!k) return;
  const old = params[k].v, v = +e.target.value || 0;
  params[k].v = v; renderMuni();
  Store.setParam(k, v).then(() => toast("Precio actualizado y registrado en el historial."))
    .catch(err => { params[k].v = old; renderMuni(); toast("No se pudo guardar: " + (err.message || err)); });
});

const ROLES = {vecino:"Vecino", moderador:"Moderación", municipal:"Municipalidad", admin:"Administración"};
function renderAccess(){
  const u = Store.user, logout = `<button class="btn small" id="btnLogout" type="button" style="margin-left:auto">Salir</button>`;
  if (state.staff) $("#access").innerHTML = `<span class="chip" style="color:var(--ok)">● ${ROLES[u.rol]}</span><span class="who">${esc(u.nombre || u.email || "")}</span><span class="note">${state.muni ? "Podés cambiar estados, cargar obras y ajustar precios. Todo queda en el historial." : "Podés verificar denuncias o marcarlas como falsas."}</span>${logout}`;
  else if (u && !u.anon) $("#access").innerHTML = `<span class="chip">Vista pública</span><span class="note">Ingresaste como ${esc(u.email || "vecino")}. Tu cuenta todavía no tiene permisos de moderación ni municipales: pedile al administrador del mapa que te habilite.</span>${logout}`;
  else $("#access").innerHTML = `<span class="chip">Vista pública</span><span class="note">Cualquier vecino puede ver montos, contratistas y fechas. Solo la municipalidad puede cargar o editar.</span><button class="btn small primary" id="btnLogin" type="button" style="margin-left:auto">Ingresar</button>`;
}
$("#access").addEventListener("click", async e => {
  if (e.target.closest("#btnLogin")) openLogin();
  else if (e.target.closest("#btnLogout")){ await Store.signOut(); toast("Sesión cerrada."); }
});
function renderModq(){
  const fakes = rawReportsAll().filter(r => r.mod === "falsa").sort((a,b) => b.t - a.t);
  $("#modfake").innerHTML = state.staff ? (fakes.map(r => `<button type="button" data-open="${esc(r.id)}"><span><b>${CATS[r.cat].one}</b> · ${esc(r.barrio)} · ${ago(r.t)}</span><span class="flag bad">✕ falsa</span></button>`).join("") || `<div class="empty">Ninguna por ahora.</div>`) : `<div class="empty">Solo visible para la municipalidad.</div>`;
  const q = allReports().filter(r => (r.flags||0) > 0 && !r.mod).sort((a,b) => (b.flags||0)-(a.flags||0)).slice(0,12);
  $("#modq").innerHTML = q.map(r => `<button type="button" data-open="${esc(r.id)}"><span><b>${CATS[r.cat].one}</b> · ${esc(r.barrio)} ${hasPhoto(r) ? "· con foto" : "· sin foto"}</span><span class="flag ${r.flags>=3?"bad":"warn"}">⚑ ${r.flags}</span></button>`).join("") || `<div class="empty">No hay denuncias marcadas por vecinos.</div>`;
}
$("#modfake").addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (!b) return; const r = findReport(b.dataset.open); if (!r) return; location.hash = "mapa"; setTimeout(() => { map.setView([r.lat,r.lng], 16); openDetail(r.id); }, 60); });
$("#modq").addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (!b) return; const r = findReport(b.dataset.open); if (!r) return; location.hash = "mapa"; setTimeout(() => { map.setView([r.lat,r.lng], 16); openDetail(r.id); }, 60); });
function renderMuni(){
  renderAccess(); renderParams(); renderAudit(); renderModq();
  const os = allObras().map(o => { const r = findReport(o.reportId); const ref = refCost(o, r); return {o, r, ref, dev:(o.monto-ref.total)/ref.total}; }).sort((a,b)=>b.dev-a.dev);
  const active = os.filter(x => x.o.estado!=="Terminada").length;
  const inv = os.reduce((a,x)=>a+x.o.monto,0), alert = os.filter(x=>x.dev>.3), exceso = os.reduce((a,x)=>a+Math.max(0,x.o.monto-x.ref.total*1.15),0);
  $("#muniKpis").innerHTML = [
    ["Obras registradas", fmtN(os.length), `${active} en ejecución o planificadas`],
    ["Inversión declarada", fmtGs(inv), "suma de todas las obras"],
    ["Con alerta", fmtN(alert.length), "monto más de 30% sobre la referencia"],
    ["Posible sobrecosto", fmtGs(exceso), "lo que excede la referencia + 15%"],
  ].map(([l,v,s]) => `<div class="kpi"><div class="eyebrow">${l}</div><div class="v" style="${l==="Con alerta"&&alert.length?"color:var(--bad)":""}">${v}</div><div class="s">${s}</div></div>`).join("");
  $("#obrasBody").innerHTML = os.map(({o,r,ref,dev}) => `<tr data-obra="${esc(o.reportId)}"><td><span class="chip c" style="--c:${cvar(r.cat)}">${CATS[r.cat].one}</span> <span class="mono note">${esc(r.id)}</span></td><td>${esc(r.barrio)}</td><td>${esc(o.contratista)}</td><td>${fmtDate(o.fecha)}</td><td class="num mono">${fmtGs(o.monto)}</td><td class="num mono">${fmtGs(ref.total)}</td><td>${flagChip(dev)}</td><td>${esc(o.estado)}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No hay obras registradas.</td></tr>`;
}
$("#obrasBody").addEventListener("click", e => { const tr = e.target.closest("[data-obra]"); if (tr) openObraEditor(tr.dataset.obra); });

let editing = null;
function openObraEditor(reportId, isNew){
  const r = findReport(reportId); if (!r) return;
  const ex = getObra(reportId);
  editing = ex ? {...ex} : {reportId, tipo:r.cat, contratista:"", responsable:RESPONSABLES[0], fecha:new Date(Date.now()+7*DAY).toISOString().slice(0,10), estado:"Planificada",
    m2: r.ai?.area_m2 || (r.sev>=4?2.2:1.2), prof:.07, personas: r.cat==="bache"?4:2, horas: r.cat==="bache"?5:3, horasVeh: r.cat==="bache"?2.5:1, viajes:1, unidades:1, monto:0};
  if (!ex) editing.monto = Math.round(refCost(editing, r).total/1000)*1000;
  const ro = !state.muni;
  const dis = ro ? "disabled" : "";
  const ed = $("#obraEditor"); ed.hidden = false;
  ed.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
      <div><div class="eyebrow mono">${esc(r.id)} · ${esc(r.barrio)}</div><h3>${ex ? "Obra" : "Nueva obra"}: ${CATS[r.cat].one}</h3><div class="sub" style="margin-top:2px">${esc(r.desc)}</div></div>
      <button class="x" type="button" aria-label="Cerrar" id="edClose">×</button>
    </div>
    ${ro ? `<div class="note">Vista pública: solo lectura. Ingresá como municipalidad para editar.</div>` : ""}
    <div class="grid2">
      <div class="field"><label for="oContr">Empresa contratista</label><input class="inp" id="oContr" list="contrList" value="${esc(editing.contratista)}" ${dis}><datalist id="contrList">${CONTRATISTAS.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></div>
      <div class="field"><label for="oResp">Responsable</label><input class="inp" id="oResp" list="respList" value="${esc(editing.responsable)}" ${dis}><datalist id="respList">${RESPONSABLES.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></div>
      <div class="field"><label for="oFecha">Fecha prevista de arreglo</label><input class="inp" type="date" id="oFecha" value="${esc(editing.fecha)}" ${dis}></div>
      <div class="field"><label for="oEstado">Estado</label><select class="inp" id="oEstado" ${dis}>${["Planificada","En ejecución","Terminada"].map(s=>`<option ${s===editing.estado?"selected":""}>${s}</option>`).join("")}</select></div>
    </div>
    <div class="eyebrow">Datos para el costo de referencia</div>
    <div class="grid2">
      ${r.cat==="bache" ? `<div class="field"><label for="oM2">Área del bache (m²)</label><input class="inp mono" type="number" step="0.1" id="oM2" value="${editing.m2}" ${dis}><small>Estimación inicial según la gravedad; corregila con la medida real</small></div>
      <div class="field"><label for="oProf">Profundidad (m)</label><input class="inp mono" type="number" step="0.01" id="oProf" value="${editing.prof}" ${dis}></div>` : ""}
      ${r.cat==="alumbrado" ? `<div class="field"><label for="oUni">Luminarias</label><input class="inp mono" type="number" step="1" id="oUni" value="${editing.unidades||1}" ${dis}></div>` : ""}
      <div class="field"><label for="oPers">Personas</label><input class="inp mono" type="number" step="1" id="oPers" value="${editing.personas}" ${dis}></div>
      <div class="field"><label for="oHoras">Horas de trabajo</label><input class="inp mono" type="number" step="0.5" id="oHoras" value="${editing.horas}" ${dis}></div>
      <div class="field"><label for="oVeh">Horas de vehículos</label><input class="inp mono" type="number" step="0.5" id="oVeh" value="${editing.horasVeh}" ${dis}></div>
      <div class="field"><label for="oViajes">Viajes desde el depósito</label><input class="inp mono" type="number" step="1" id="oViajes" value="${editing.viajes||1}" ${dis}></div>
    </div>
    <div class="field"><label for="oMonto">Monto declarado por la municipalidad (Gs.)</label><input class="inp mono" type="number" step="1000" id="oMonto" value="${editing.monto}" ${dis}></div>
    <div id="edCalc"></div>
    <div class="eyebrow">Prueba del trabajo</div>
    <div class="photos">
      <label class="photo-slot" for="oAntes">${editing.fotoAntes ? `<img src="${esc(editing.fotoAntes)}" alt="Antes">` : "Foto antes<br><span class='note'>con hora y GPS</span>"}</label>
      <label class="photo-slot" for="oDespues">${editing.fotoDespues ? `<img src="${esc(editing.fotoDespues)}" alt="Después">` : "Foto después<br><span class='note'>con hora y GPS</span>"}</label>
    </div>
    <input type="file" id="oAntes" accept="image/*" hidden ${dis}><input type="file" id="oDespues" accept="image/*" hidden ${dis}>
    ${ro ? "" : `<div class="rowbtns"><button class="btn primary" type="button" id="edSave">Guardar obra</button><button class="btn" type="button" id="edCancel">Cancelar</button></div>`}`;
  ed.scrollIntoView({behavior:"smooth", block:"start"});
  const recalc = () => {
    const g = id => $(id) ? +$(id).value : undefined;
    Object.assign(editing, {m2:g("#oM2") ?? editing.m2, prof:g("#oProf") ?? editing.prof, unidades:g("#oUni") ?? editing.unidades, personas:g("#oPers"), horas:g("#oHoras"), horasVeh:g("#oVeh"), viajes:g("#oViajes"), monto:g("#oMonto")});
    const c = refCost(editing, r), dev = (editing.monto - c.total)/c.total;
    $("#edCalc").innerHTML = `<table class="breakdown">
      <tr><td>Materiales · ${esc(c.matLbl)}</td><td>${fmtGs(c.mat)}</td></tr>
      <tr><td>Mano de obra · ${editing.personas} personas × ${editing.horas} h</td><td>${fmtGs(c.mo)}</td></tr>
      <tr><td>Vehículos · ${editing.horasVeh} h de máquina</td><td>${fmtGs(c.veh)}</td></tr>
      <tr><td>Traslado · ${(c.km*(editing.viajes||1)).toFixed(1)} km ida y vuelta desde el depósito</td><td>${fmtGs(c.fuel)}</td></tr>
      <tr><td>Gastos generales (${params.gg.v}%)</td><td>${fmtGs(c.gg)}</td></tr>
      <tr class="tot"><td>Costo de referencia IA</td><td>${fmtGs(c.total)}</td></tr>
      <tr><td>Monto declarado</td><td>${fmtGs(editing.monto)}</td></tr></table>${flagHtml(dev)}`;
  };
  ed.oninput = recalc; recalc();
  const photo = (inp, key) => $(inp).addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; editing[key] = await downscale(f, 320); const slot = ed.querySelector(`label[for="${inp.slice(1)}"]`); slot.innerHTML = `<img src="${editing[key]}" alt="">`; });
  photo("#oAntes","fotoAntes"); photo("#oDespues","fotoDespues");
  $("#edClose").onclick = () => { ed.hidden = true; editing = null; };
  if ($("#edCancel")) $("#edCancel").onclick = () => { ed.hidden = true; editing = null; };
  if ($("#edSave")) $("#edSave").onclick = () => saveObra(r, ex);
}
async function saveObra(r, prev){
  Object.assign(editing, {contratista:$("#oContr").value.trim(), responsable:$("#oResp").value.trim(), fecha:$("#oFecha").value, estado:$("#oEstado").value});
  if (!editing.contratista){ toast("Indicá la empresa contratista."); $("#oContr").focus(); return; }
  if (!editing.monto){ toast("Indicá el monto declarado."); $("#oMonto").focus(); return; }
  const o = {...editing}; delete o.demo;
  const changes = [];
  if (!prev) changes.push(`${o.contratista} · ${fmtGs(o.monto)}`);
  else for (const [k,l] of [["monto","Monto"],["contratista","Contratista"],["fecha","Fecha"],["estado","Estado"],["responsable","Responsable"]]) if (prev[k] !== o[k]) changes.push(`${l}: ${k==="monto"?fmtGs(prev[k]):prev[k]} → ${k==="monto"?fmtGs(o[k]):o[k]}`);
  $("#edSave").disabled = true;
  try { await Store.saveObra(o, prev, changes); obrasLive.set(r.id, o); }
  catch(err){ $("#edSave").disabled = false; toast("No se pudo guardar la obra: " + (err.message || err)); return; }
  if (o.estado==="En ejecución" && r.status==="recibida") await patchReport(r, {status:"en_proceso"});
  if (o.estado==="Terminada" && r.status!=="resuelta") await patchReport(r, {status:"resuelta"});
  $("#obraEditor").hidden = true; editing = null;
  toast("Obra guardada y publicada.");
  renderMuni();
}

/* ---------- Estadísticas ---------- */
function renderStats(){
  const now = Date.now(), per = PERIODS[state.period];
  const rs = allReports(), inP = rs.filter(r => inPeriod(r, state.period, now));
  const res = inP.filter(r => r.status==="resuelta");
  const resolvedTimes = inP.filter(r => r.status==="resuelta" && r.resolvedAt > r.t).map(r => (r.resolvedAt - r.t)/DAY);
  const avgDays = resolvedTimes.length ? resolvedTimes.reduce((a,b)=>a+b,0)/resolvedTimes.length : 0;
  const as = rs.filter(r=>r.cat==="asalto");
  $("#kpis").innerHTML = [
    ["Asaltos", fmtN(inP.filter(r=>r.cat==="asalto").length), per.label, "color:var(--c-asalto)"],
    ["Denuncias", fmtN(inP.length), "todas las categorías", ""],
    ["Resueltas", inP.length ? Math.round(res.length/inP.length*100)+"%" : "—", `${fmtN(res.length)} de ${fmtN(inP.length)}`, ""],
    ["Resolución media", avgDays ? avgDays.toFixed(1)+" días" : "—", "desde la denuncia hasta el arreglo", ""],
  ].map(([l,v,s,st]) => `<div class="kpi"><div class="eyebrow">${l}</div><div class="v" style="${st}">${v}</div><div class="s">${s}</div></div>`).join("");

  const bk = buckets(state.period, now), vals = bk.map(b => as.filter(r => r.t>b.s && r.t<=b.e).length);
  $("#asaltoChartSub").textContent = `${per.label} · ${fmtN(vals.reduce((a,b)=>a+b,0))} en total`;
  barChart($("#asaltoChart"), vals, bk.map(b=>b.l), "var(--c-asalto)");
  const hours = Array(24).fill(0); as.filter(r => inPeriod(r, state.period, now)).forEach(r => hours[new Date(r.t).getHours()]++);
  barChart($("#hourChart"), hours, hours.map((_,i)=>i+"h"), "var(--c-inseguro)", true);

  const counts = CAT_KEYS.map(k => [k, inP.filter(r=>r.cat===k).length]).sort((a,b)=>b[1]-a[1]), mx = Math.max(1, ...counts.map(c=>c[1]));
  $("#catBars").innerHTML = counts.map(([k,n]) => `<div class="hbar"><span>${CATS[k].n}</span><div class="tr"><div class="fl" style="width:${n/mx*100}%;--c:${cvar(k)}"></div></div><span class="n">${n}</span></div>`).join("");
  const sel = $("#barrioCat"); if (!sel.options.length) sel.innerHTML = `<option value="">Todas</option>` + CAT_KEYS.map(k=>`<option value="${k}">${CATS[k].n}</option>`).join("");
  const bc = sel.value, by = {}; inP.filter(r => !bc || r.cat===bc).forEach(r => by[r.barrio] = (by[r.barrio]||0)+1);
  const top = Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,6), m2 = Math.max(1, ...top.map(t=>t[1]));
  $("#barrioBars").innerHTML = top.map(([b,n]) => `<div class="hbar"><span>${esc(b)}</span><div class="tr"><div class="fl" style="width:${n/m2*100}%;--c:${bc?cvar(bc):"var(--accent)"}"></div></div><span class="n">${n}</span></div>`).join("") || `<div class="empty">Sin denuncias en este período.</div>`;
}
$("#barrioCat").addEventListener("change", renderStats);
function barChart(svg, vals, labels, color, peak){
  const W=520, H=200, L=30, B=22, T=8, n=vals.length, mx = Math.max(1, ...vals);
  const step = mx<=5?1:mx<=10?2:mx<=25?5:mx<=50?10:Math.ceil(mx/50)*10, top = Math.ceil(mx/step)*step;
  const y = v => T + (H-T-B)*(1 - v/top), bw = (W-L-6)/n;
  let s = "";
  for (let v=0; v<=top; v+=step) s += `<line class="grid" x1="${L}" x2="${W-4}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-5}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
  const pk = peak ? vals.indexOf(mx) : -1;
  vals.forEach((v,i) => {
    const h = Math.max(v?2:0, (H-T-B)*v/top);
    s += `<rect x="${(L+i*bw+bw*.16).toFixed(1)}" y="${(y(0)-h).toFixed(1)}" width="${(bw*.68).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}" opacity="${peak ? (i===pk?1:.55) : (i===n-1?1:.7)}"><title>${labels[i]}: ${v}</title></rect>`;
    const every = Math.ceil(n/12);
    if (i % every === 0 || i===n-1 && n<=12) s += `<text x="${(L+i*bw+bw/2).toFixed(1)}" y="${H-6}" text-anchor="middle">${esc(labels[i])}</text>`;
  });
  svg.innerHTML = s;
}
$("#btnAiReport").addEventListener("click", async () => {
  const out = $("#aiReport"), btn = $("#btnAiReport");
  const now = Date.now(), inP = allReports().filter(r => inPeriod(r, state.period, now));
  const byCat = Object.fromEntries(CAT_KEYS.map(k => [CATS[k].n, inP.filter(r=>r.cat===k).length]));
  const byBarrio = {}; inP.forEach(r => { byBarrio[r.barrio] = byBarrio[r.barrio]||{}; byBarrio[r.barrio][r.cat] = (byBarrio[r.barrio][r.cat]||0)+1; });
  const hours = Array(24).fill(0); inP.filter(r=>r.cat==="asalto").forEach(r => hours[new Date(r.t).getHours()]++);
  const pend = inP.filter(r => r.status!=="resuelta").length;
  const alerts = allObras().map(o => { const r = findReport(o.reportId); const ref = refCost(o, r); return {id:o.reportId, contratista:o.contratista, desvio_pct:Math.round((o.monto-ref.total)/ref.total*100)}; }).filter(x => x.desvio_pct > 30);
  const data = {ciudad:"Ciudad del Este", periodo:PERIODS[state.period].label, total:inP.length, pendientes:pend, por_categoria:byCat, por_barrio:byBarrio, asaltos_por_hora:hours, obras_con_alerta_sobrefacturacion:alerts};
  btn.disabled = true; out.textContent = "Preparando el informe…";
  const auto = () => {
    const topB = Object.entries(byBarrio).map(([b,c]) => [b, Object.values(c).reduce((a,x)=>a+x,0)]).sort((a,b)=>b[1]-a[1]);
    const peakH = hours.indexOf(Math.max(...hours));
    const topCat = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
    return `- ${topB[0]?.[0]||"—"} concentra la mayor cantidad de denuncias (${topB[0]?.[1]||0}); conviene reforzar allí la cuadrilla y el patrullaje.\n- Los asaltos se concentran alrededor de las ${peakH}:00; coordinar con la Policía Nacional presencia en paradas a esa hora.\n- La categoría más denunciada es ${topCat?.[0]} (${topCat?.[1]}).\n- Hay ${pend} denuncias sin resolver en el período.\n- ${alerts.length} obras tienen montos más de 30% sobre la referencia y deberían auditarse.\nPrioridad de la semana: ${topB[0]?.[0]||"—"}.`;
  };
  if (IA.enabled){
    try { out.textContent = await IA.ask("informe", data); $("#aiReportTag").textContent = "✦ Redactado por Claude"; }
    catch(err){ out.textContent = auto(); toast(err.message || "La IA no respondió; se muestra el informe automático."); }
  } else out.textContent = auto();
  btn.disabled = false;
});

/* ---------- Vistas ---------- */
function route(){
  const v = (location.hash || "#mapa").slice(1);
  const view = ["mapa","estadisticas","municipalidad"].includes(v) ? v : "mapa";
  $$(".view").forEach(s => s.hidden = s.id !== "view-" + view);
  $$(".tabs a").forEach(a => a.setAttribute("aria-current", a.dataset.view===view ? "page" : "false"));
  if (view==="mapa") setTimeout(()=>map.invalidateSize(), 30);
  if (view==="estadisticas") renderStats();
  if (view==="municipalidad") renderMuni();
}
window.addEventListener("hashchange", route);

let rT = null;
function refresh(){
  clearTimeout(rT);
  rT = setTimeout(() => {
    renderPeriodSegs(); renderSide(); renderPins();
    if (!$("#view-estadisticas").hidden) renderStats();
    if (!$("#view-municipalidad").hidden) renderMuni();
  }, 16);
}
setInterval(() => { renderSide(); }, 60000);

function setLive(mode, text){
  const p = $("#livePill"); p.classList.toggle("on", mode==="on");
  p.querySelector("span").textContent = text;
}

/* ---------- Cuentas: vecinos sin registro, moderación y municipalidad con email o Google ---------- */
function openLogin(){
  const u = Store.user;
  showDrawer(`
    <div class="drawer-head"><div><div class="eyebrow">Cuenta</div><h2>Ingresar</h2></div><button class="x" type="button" aria-label="Cerrar" data-close>×</button></div>
    <div class="drawer-body">
      ${Store.mode === "supabase" ? `
      <p class="note" style="margin:0">Para denunciar no hace falta cuenta. Ingresá si sos de la municipalidad o de la moderación, o si querés seguir tus denuncias desde otro celular.</p>
      ${u && !u.anon ? `<div class="okbox">Ya ingresaste como <b>${esc(u.email || "")}</b> · rol: ${ROLES[u.rol] || "Vecino"}.</div><button class="btn" type="button" id="lgOut">Salir</button>` : `
      <form class="field" id="lgForm"><label for="lgEmail">Tu email</label><input class="inp" id="lgEmail" type="email" autocomplete="email" required placeholder="nombre@ejemplo.com">
        <label for="lgPass" style="margin-top:8px">Contraseña <span class="note">(si el administrador te dio una)</span></label><input class="inp" id="lgPass" type="password" autocomplete="current-password">
        <button class="btn primary" type="submit" style="margin-top:8px" id="lgSubmit">Enviarme un enlace para entrar</button><small>Sin contraseña te llega un correo con un enlace: tocalo desde este mismo celular o computadora.</small></form>
      ${CFG.google ? `<button class="btn" type="button" id="lgGoogle">Entrar con Google</button>` : ""}`}`
      : `<p class="note" style="margin:0">Estás en el <b>modo de prueba</b> (sin base de datos configurada). Elegí un rol para recorrer la página; nada se guarda.</p>
      <div class="rowbtns"><button class="btn primary" type="button" data-role="municipal">Entrar como municipalidad</button><button class="btn" type="button" data-role="moderador">Entrar como moderación</button>${state.staff ? `<button class="btn" type="button" id="lgOut">Salir</button>` : ""}</div>`}
      <div class="note" id="lgMsg"></div>
    </div>`);
  $("#lgPass")?.addEventListener("input", e => { $("#lgSubmit").textContent = e.target.value ? "Entrar" : "Enviarme un enlace para entrar"; });
  $("#lgForm")?.addEventListener("submit", async e => {
    e.preventDefault(); const email = $("#lgEmail").value.trim(), pass = $("#lgPass").value, msg = $("#lgMsg");
    msg.textContent = pass ? "Entrando…" : "Enviando…";
    try {
      if (pass){ await Store.signInPassword(email, pass); closeDrawer(); toast("Sesión iniciada."); }
      else { await Store.signInEmail(email); msg.innerHTML = `<b>Listo.</b> Revisá tu correo (${esc(email)}) y tocá el enlace. Si no aparece, mirá en spam.`; }
    }
    catch(err){ msg.textContent = (pass ? "No se pudo entrar: " : "No se pudo enviar: ") + (err.message || err); }
  });
  $("#lgGoogle")?.addEventListener("click", () => Store.signInGoogle().catch(err => toast(err.message || String(err))));
  $("#lgOut")?.addEventListener("click", async () => { await Store.signOut(); closeDrawer(); toast("Sesión cerrada."); });
  $$("[data-role]", drawer).forEach(b => b.addEventListener("click", async () => { await Store.signInAs(b.dataset.role); closeDrawer(); toast(`Entraste como ${ROLES[b.dataset.role].toLowerCase()} (prueba).`); }));
}
$("#btnAccount").addEventListener("click", openLogin);
function applyUser(u){
  state.staff = ["moderador","municipal","admin"].includes(u?.rol);
  state.muni = ["municipal","admin"].includes(u?.rol);
  $("#btnAccount").lastChild.textContent = u && !u.anon ? (state.staff ? ROLES[u.rol] : "Mi cuenta") : "Ingresar";
  if (!$("#view-municipalidad").hidden) renderMuni();
  if (state.sel && !drawer.hidden && findReport(state.sel)) openDetail(state.sel);
}

/* ---------- IA opcional: Claude explica zonas y redacta el informe, a través de la función del servidor ---------- */
const IA = {
  enabled: false,
  async check(){
    if (CFG.ia === false) return;
    try { const r = await fetch(CFG.iaUrl || "/api/ia", {headers:{accept:"application/json"}}); if (r.ok) this.enabled = !!(await r.json()).enabled; } catch(e) {}
  },
  async ask(tipo, datos){
    const token = await Store.accessToken();
    const r = await fetch(CFG.iaUrl || "/api/ia", {method:"POST", headers:{"content-type":"application/json", ...(token ? {authorization:"Bearer " + token} : {})}, body:JSON.stringify({tipo, datos})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.texto) throw new Error(j.error || "La IA no respondió.");
    return j.texto;
  }
};

/* ---------- Datos: Supabase en vivo, o modo de prueba si todavía no está configurado ---------- */
const CFG = window.CDE_CONFIG || {};
const Store = window.CDEStore.create(CFG, {
  reports(list){ live.clear(); list.forEach(r => { if (CATS[r.cat] && isFinite(r.lat)) live.set(r.id, r); }); refresh(); },
  report(r, gone){ if (gone || !CATS[r.cat]) live.delete(r.id); else live.set(r.id, {...live.get(r.id), ...r}); refresh(); },
  obras(list){ obrasLive.clear(); list.forEach(o => obrasLive.set(o.reportId, o)); refresh(); },
  audit(list){ auditLive = list; if (!$("#view-municipalidad").hidden) renderAudit(); },
  params(list){ list.forEach(p => { params[p.k] = {n:p.n, v:p.v, o:p.o}; }); if (!$("#view-municipalidad").hidden) renderMuni(); },
  user: applyUser,
  status(mode, text){ setLive(mode, text); },
  error(msg){ toast(msg); }
});

renderPeriodSegs(); renderSide(); renderPins(); route();
Store.start();
IA.check().then(() => { if (IA.enabled) $("#aiReportSub").textContent = "Claude lee las estadísticas del período y sugiere dónde actuar primero."; });
})();

// Service worker del Mapa Ciudadano CDE.
// - La página abre aunque no haya internet, con lo último que se cargó (denuncias y fotos).
//   Las imágenes satelitales de Esri no se guardan: sus condiciones de uso no lo permiten.
// - Muestra los avisos del sistema y, al tocarlos, abre la denuncia.
const PAGINA = "cde-pagina-v2", DATOS = "cde-datos-v2", IMAGENES = "cde-imagenes-v2";
const BASE = ["./", "index.html", "config.js", "store.js", "app.js", "vendor/leaflet.js", "vendor/supabase.js", "datos-ejemplo.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(PAGINA).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  const usadas = [PAGINA, DATOS, IMAGENES];
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !usadas.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero internet (para ver siempre lo último); si no hay señal, lo guardado.
async function redPrimero(req, cache, opciones){
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(cache)).put(req, res.clone());
    return res;
  } catch(err){
    const guardada = await caches.match(req, opciones);
    if (guardada) return guardada;
    if (req.mode === "navigate") return (await caches.match("index.html")) || Response.error();
    throw err;
  }
}
// Primero lo guardado (fotos y mapa no cambian); se guarda la primera vez que se ven.
async function guardadoPrimero(req){
  const guardada = await caches.match(req);
  if (guardada) return guardada;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque"){
    const c = await caches.open(IMAGENES);
    c.put(req, res.clone());
    c.keys().then(ks => { if (ks.length > 600) ks.slice(0, ks.length - 600).forEach(k => c.delete(k)); });
  }
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin){
    if (url.pathname.startsWith("/api/")) return;
    if (/\.(jpg|png|webp)$/.test(url.pathname) || url.pathname.startsWith("/vendor/")) return e.respondWith(guardadoPrimero(req));
    return e.respondWith(redPrimero(req, PAGINA, {ignoreSearch:true}));
  }
  if (url.hostname.endsWith(".supabase.co")){
    if (url.pathname.startsWith("/rest/v1/")) return e.respondWith(redPrimero(req, DATOS));
    if (url.pathname.startsWith("/storage/v1/object/public/")) return e.respondWith(guardadoPrimero(req));
    return;
  }
  if (url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com")
    return e.respondWith(guardadoPrimero(req));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const id = e.notification.data?.id;
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({type:"window", includeUncontrolled:true});
    const c = abiertas[0];
    if (c){ await c.focus(); if (id) c.postMessage({abrir:id}); return; }
    return self.clients.openWindow("./" + (id ? "?denuncia=" + encodeURIComponent(id) : ""));
  })());
});

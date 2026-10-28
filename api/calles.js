// Función del servidor (Vercel) que entrega las calles del centro de Ciudad del Este para el mapa de calles propio.
// Los datos son de OpenStreetMap (licencia ODbL, se pueden guardar y reutilizar citando la fuente).
// Se piden a Overpass una vez y Vercel guarda la respuesta una semana, así los visitantes no dependen de ese servidor.

const CAJA = "-25.545,-54.665,-25.485,-54.595";
const CONSULTA = `[out:json][timeout:90];(way["highway"~"^(trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](${CAJA});way["leisure"="park"](${CAJA});way["natural"="water"](${CAJA});way["waterway"~"^(river|stream)$"](${CAJA}););out geom;`;
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const config = {maxDuration:60};

// Se prueba con POST y con GET, porque algunos servidores rechazan uno de los dos.
async function pedir(url, metodo){
  const opciones = {headers:{accept:"application/json,*/*", "user-agent":"MapaCiudadanoCDE/1.0"}, signal:AbortSignal.timeout(45000)};
  const r = metodo === "GET" ? await fetch(url + "?data=" + encodeURIComponent(CONSULTA), opciones)
    : await fetch(url, {...opciones, method:"POST", body:new URLSearchParams({data:CONSULTA})});
  if (!r.ok) throw new Error(metodo + " " + url + ": " + r.status);
  return r.json();
}

export default async function handler(req, res){
  let datos = null, errores = [];
  try { datos = await Promise.any(SERVIDORES.flatMap(url => ["POST", "GET"].map(m => pedir(url, m)))); }
  catch(err){ errores = (err.errors || [err]).map(e => e.message); }
  if (!datos){ res.setHeader("cache-control", "no-store"); return res.status(502).json({error:"No se pudieron obtener las calles.", detalle:errores}); }

  // Solo lo que dibuja el mapa, con 5 decimales (un metro de precisión).
  const r5 = x => Math.round(x * 1e5) / 1e5;
  const elementos = datos.elements.filter(e => e.type === "way" && e.geometry).map(e => ({
    tags:Object.fromEntries(["highway", "name", "leisure", "natural", "waterway"].filter(k => e.tags?.[k]).map(k => [k, e.tags[k]])),
    geometry:e.geometry.map(p => ({lat:r5(p.lat), lon:r5(p.lon)})), type:"way"}));
  if (req.query?.contar) return res.status(200).json({calles:elementos.filter(e => e.tags.highway).length, otros:elementos.filter(e => !e.tags.highway).length});
  res.setHeader("cache-control", "public, s-maxage=604800, stale-while-revalidate=2592000");
  return res.status(200).json({fuente:"© colaboradores de OpenStreetMap (ODbL)", elements:elementos});
}

// Función del servidor (Vercel) que entrega las calles del centro de Ciudad del Este para el mapa de calles propio.
// Los datos son de OpenStreetMap (licencia ODbL, se pueden guardar y reutilizar citando la fuente).
// Se piden a Overpass una vez y Vercel guarda la respuesta una semana, así los visitantes no dependen de ese servidor.

const CAJA = "-25.545,-54.665,-25.485,-54.595";
const CONSULTA = `[out:json][timeout:90];(way["highway"~"^(trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](${CAJA});way["leisure"="park"](${CAJA});way["natural"="water"](${CAJA});way["waterway"~"^(river|stream)$"](${CAJA}););out geom;`;
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const config = {maxDuration:60};

async function pedir(url){
  const r = await fetch(url, {method:"POST", body:"data=" + encodeURIComponent(CONSULTA),
    headers:{"content-type":"application/x-www-form-urlencoded", "accept":"application/json", "user-agent":"MapaCiudadanoCDE/1.0 (+https://mapa-cde-zspd.vercel.app)"},
    signal:AbortSignal.timeout(14000)});
  if (!r.ok) throw new Error(url + ": " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

export default async function handler(req, res){
  let datos = null, errores = [];
  for (const url of SERVIDORES){
    try { datos = await pedir(url); break; } catch(err){ errores.push(err.message); }
  }
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

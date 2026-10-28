// Dibuja el mapa de calles propio como imágenes (calles/{z}/{x}/{y}.webp) para la zona de Ciudad del Este.
// Así la página muestra las calles como imágenes y cualquier computadora o celular las mueve sin trabarse,
// tenga o no aceleración por hardware. Lo ejecuta .github/workflows/dibujar-calles.yml (necesita internet y Chromium).
//
// Uso: node scripts/dibujar-calles.mjs [zoomMin] [zoomMax]     (por defecto 13 a 17)
import {createServer} from "node:http";
import {readFile, mkdir, writeFile, rm} from "node:fs/promises";
import {createRequire} from "node:module";
import {extname, join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const {chromium} = createRequire(import.meta.url)("playwright");
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZONA = {sur:-25.591994, oeste:-54.722900, norte:-25.453195, este:-54.580078};   // la misma del satélite (SAT_BOUNDS en app.js)
const [ZMIN, ZMAX] = [Number(process.argv[2] || 13), Number(process.argv[3] || 17)];
const BLOQUE = 4, BORDE = 1;

const tx = (lng, z) => Math.floor((lng + 180) / 360 * 2 ** z);
const ty = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };

// Servidor local para que la página de dibujo cargue MapLibre y el estilo.
const TIPOS = {".html":"text/html", ".js":"text/javascript", ".css":"text/css"};
const servidor = createServer(async (req, res) => {
  try { const ruta = join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!ruta.startsWith(RAIZ)) throw 0;
    res.writeHead(200, {"content-type":TIPOS[extname(ruta)] || "application/octet-stream"}); res.end(await readFile(ruta));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const puerto = servidor.address().port;

const navegador = await chromium.launch({args:["--ignore-gpu-blocklist", "--enable-webgl"]});
const pagina = await navegador.newPage();
pagina.on("pageerror", e => console.error("Error en la página:", e.message));
// Para probar el script sin internet: CALLES_PRUEBA=1 responde teselas vacías (las imágenes salen solo con el fondo).
if (process.env.CALLES_PRUEBA){
  await pagina.route("https://tiles.openfreemap.org/**", r => r.request().url().endsWith("/planet")
    ? r.fulfill({contentType:"application/json", body:JSON.stringify({tilejson:"3.0.0", tiles:["https://tiles.openfreemap.org/x/{z}/{x}/{y}.pbf"], maxzoom:14, vector_layers:[]})})
    : r.fulfill({status:204, body:""}));
}
await pagina.goto(`http://localhost:${puerto}/scripts/calles/dibujar.html`);
await pagina.evaluate(lado => preparar(lado), BLOQUE + 2 * BORDE);
console.log("Mapa listo, dibujando…");

await rm(join(RAIZ, "calles"), {recursive:true, force:true});
let total = 0;
for (let z = ZMIN; z <= ZMAX; z++){
  const [x1, x2, y1, y2] = [tx(ZONA.oeste, z), tx(ZONA.este, z), ty(ZONA.norte, z), ty(ZONA.sur, z)];
  for (let x0 = x1; x0 <= x2; x0 += BLOQUE) for (let y0 = y1; y0 <= y2; y0 += BLOQUE){
    const teselas = await pagina.evaluate(a => dibujar(...a), [z, x0, y0, BLOQUE, BORDE]);
    for (const t of teselas){
      if (t.x > x2 || t.y > y2) continue;
      await mkdir(join(RAIZ, "calles", String(z), String(t.x)), {recursive:true});
      await writeFile(join(RAIZ, "calles", String(z), String(t.x), t.y + ".webp"), Buffer.from(t.img, "base64"));
      total++;
    }
  }
  console.log(`Zoom ${z} listo (${total} imágenes en total)`);
}
await writeFile(join(RAIZ, "calles", "info.json"), JSON.stringify({zoomMin:ZMIN, zoomMax:ZMAX, zona:ZONA, fecha:new Date().toISOString(),
  fuente:"© colaboradores de OpenStreetMap (ODbL), vía OpenFreeMap"}, null, 2));
await navegador.close();
servidor.close();

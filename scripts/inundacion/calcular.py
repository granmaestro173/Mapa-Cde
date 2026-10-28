"""Zonas con posibilidad de inundación en Ciudad del Este, a partir del relieve.

Datos: Copernicus DEM GLO-30 (© DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, provisto bajo
el programa COPERNICUS de la Unión Europea y la ESA). Es un modelo de superficie: incluye techos y árboles.

Método: HAND (altura sobre el drenaje más cercano). Se rellenan pozos, se calcula hacia dónde corre el agua
en cada celda y cuánta área le aporta; donde se junta agua de más de UMBRAL_KM2 hay un cauce. Para cada celda,
HAND es cuántos metros está por encima del cauce al que drena. Poco HAND = se inunda primero cuando el cauce crece.

Solo cuentan como cauce los que existen de verdad: los arroyos y ríos de OpenStreetMap (osm.json, bajado con Overpass)
y que además juntan agua de más de UMBRAL_GRANDE_KM2 (arroyos grandes), más los que juntan más de UMBRAL_SEGURO_KM2 aunque
no estén en el mapa. Los cauces chicos de adentro de la ciudad no se usan. Sin esto, cualquier
bajada del terreno donde se junta agua de lluvia parecía un arroyo y zonas sin ningún arroyo cerca salían inundables.

Uso: python3 scripts/inundacion/calcular.py dem.tif wbm.tif [osm.json] [rutas.json]   (genera inundacion/riesgo-*.png e inundacion/datos.json)
Necesita: pip install numpy tifffile imagecodecs pillow pysheds affine
El DEM y la máscara se bajan de https://copernicus-dem-30m.s3.amazonaws.com/ (hoja Copernicus_DSM_COG_10_S26_00_W055_00_DEM).
wbm.tif es la máscara de agua que viene con el mismo DEM (AUXFILES/*_WBM.tif): ríos y lagos no se pintan.
"""
import json, math, sys, os
import numpy as np, tifffile
if not hasattr(np, "in1d"): np.in1d = np.isin   # pysheds usa una función que numpy 2 quitó
from PIL import Image
from pysheds.sview import Raster, ViewFinder
from pysheds.grid import Grid
from affine import Affine

SALIDA = os.path.join(os.path.dirname(__file__), "..", "..", "inundacion")
# Zona del mapa (la misma de la página) y un margen para que las cuencas que entran a la ciudad estén completas.
ZONA = [[-25.591994, -54.722900], [-25.453195, -54.580078]]
CALCULO = [[-25.70, -54.86], [-25.36, -54.52]]
UMBRAL_KM2 = 0.4          # área que tiene que juntar un cauce (arroyos chicos incluidos)
UMBRAL_GRANDE_KM2 = 5     # solo arroyos grandes: los cauces chicos de adentro de la ciudad no cuentan
UMBRAL_SEGURO_KM2 = 25    # con esta área es un arroyo grande aunque no figure en OpenStreetMap
CERCA_OSM = 3             # celdas (~90 m) de tolerancia entre el cauce del relieve y el trazado de OpenStreetMap
NIVELES = [(1.5, "muy_alta"), (3, "alta"), (5, "media")]   # metros de HAND
# Además de estar bajo, tiene que estar cerca de un arroyo o río real (metros en horizontal). Lo que queda lejos,
# dentro de la ciudad, no se marca aunque el terreno sea bajo: ahí el agua es de desagüe pluvial, no de crecida.
DISTANCIA = {"muy_alta": 150, "alta": 250, "media": 400}

dem_path = sys.argv[1]
t = tifffile.TiffFile(dem_path); p = t.pages[0]
paso = p.tags[33550].value[0]; x0, y0 = p.tags[33922].value[3], p.tags[33922].value[4]
dem_full = p.asarray().astype("float64")
fila = lambda lat: int(round((y0 - lat) / paso)); col = lambda lng: int(round((lng - x0) / paso))
r0, r1 = fila(CALCULO[1][0]), fila(CALCULO[0][0]); c0, c1 = col(CALCULO[0][1]), col(CALCULO[1][1])
dem = dem_full[r0:r1, c0:c1]
af = Affine(paso, 0, x0 + c0 * paso, 0, -paso, y0 - r0 * paso)
vf = ViewFinder(affine=af, shape=dem.shape, crs="EPSG:4326", nodata=np.nan)
grid = Grid(viewfinder=vf)
r = Raster(dem, viewfinder=vf)
r = grid.fill_pits(r); r = grid.fill_depressions(r); r = grid.resolve_flats(r)
fdir = grid.flowdir(r)
acc = grid.accumulation(fdir)
lat_m = 111320 * paso; lng_m = 111320 * paso * math.cos(math.radians(-25.52))
celda_km2 = lat_m * lng_m / 1e6
cauces = acc > (UMBRAL_KM2 / celda_km2)
# Cauces reales: los del relieve que coinciden con un arroyo o río de OpenStreetMap, los muy grandes, y el Paraná.
wbm_calc = tifffile.imread(sys.argv[2])[r0:r1, c0:c1]
osm = np.zeros(dem.shape, dtype=bool); n_osm = 0
if len(sys.argv) > 3 and os.path.exists(sys.argv[3]):
    for el in json.load(open(sys.argv[3])).get("elements", []):
        g = el.get("geometry") or []
        if len(g) < 2: continue
        n_osm += 1
        for a_, b_ in zip(g, g[1:]):
            pasos = max(2, int(max(abs(a_["lat"] - b_["lat"]), abs(a_["lon"] - b_["lon"])) / paso * 2) + 1)
            for k in range(pasos + 1):
                la_ = a_["lat"] + (b_["lat"] - a_["lat"]) * k / pasos; lo_ = a_["lon"] + (b_["lon"] - a_["lon"]) * k / pasos
                i_, j_ = fila(la_) - r0, col(lo_) - c0
                if 0 <= i_ < dem.shape[0] and 0 <= j_ < dem.shape[1]: osm[i_, j_] = True
from scipy.ndimage import binary_dilation
cerca = binary_dilation(osm | (wbm_calc == 3), iterations=CERCA_OSM)
cauces_relieve = np.asarray(cauces, dtype=bool)
acc_km2 = np.asarray(acc) * celda_km2
cauces = (cauces_relieve & cerca & (acc_km2 > UMBRAL_GRANDE_KM2)) | (acc_km2 > UMBRAL_SEGURO_KM2) | (wbm_calc == 3)
vf_b = ViewFinder(affine=af, shape=dem.shape, crs="EPSG:4326", nodata=False)
# Distancia en metros de cada celda al arroyo o río más cercano.
from scipy.ndimage import distance_transform_edt
dist_cauce = distance_transform_edt(~cauces, sampling=(lat_m, lng_m))
# Rutas principales (OpenStreetMap): van sobre terraplén, más altas que el relieve de 30 m, y no se pintan.
rutas = np.zeros(dem.shape, dtype=bool)
def trazar(destino, elementos):
    n = 0
    for el in elementos:
        g = el.get("geometry") or []
        if len(g) < 2: continue
        n += 1
        for a_, b_ in zip(g, g[1:]):
            pasos = max(2, int(max(abs(a_["lat"] - b_["lat"]), abs(a_["lon"] - b_["lon"])) / paso * 2) + 1)
            for k in range(pasos + 1):
                i_ = fila(a_["lat"] + (b_["lat"] - a_["lat"]) * k / pasos) - r0
                j_ = col(a_["lon"] + (b_["lon"] - a_["lon"]) * k / pasos) - c0
                if 0 <= i_ < dem.shape[0] and 0 <= j_ < dem.shape[1]: destino[i_, j_] = True
    return n
n_rutas = trazar(rutas, json.load(open(sys.argv[4])).get("elements", [])) if len(sys.argv) > 4 and os.path.exists(sys.argv[4]) else 0
print("arroyos de OpenStreetMap", n_osm, "· rutas", n_rutas, "· celdas de cauce", int(cauces_relieve.sum()), "->", int(cauces.sum()))
hand = np.asarray(grid.compute_hand(fdir, Raster(dem, viewfinder=vf), Raster(cauces, viewfinder=vf_b)), dtype="float64")
hand[hand < 0] = 0

# Recorte a la zona del mapa
zr0, zr1 = fila(ZONA[1][0]) - r0, fila(ZONA[0][0]) - r0
zc0, zc1 = col(ZONA[0][1]) - c0, col(ZONA[1][1]) - c0
agua_full = tifffile.imread(sys.argv[2])[r0:r1, c0:c1] > 0
h = hand[zr0:zr1, zc0:zc1]; agua = agua_full[zr0:zr1, zc0:zc1]; a = np.asarray(acc)[zr0:zr1, zc0:zc1]; z = dem[zr0:zr1, zc0:zc1]
lim = [[float(y0 - (r0 + zr1) * paso), float(x0 + (c0 + zc0) * paso)], [float(y0 - (r0 + zr0) * paso), float(x0 + (c0 + zc1) * paso)]]

# Una imagen por nivel (transparente fuera de ese nivel), para mostrar más o menos zonas según el escenario de lluvia.
# Se escala x3 con suavizado para que no se vean los cuadraditos, y con 32 colores pesa poco.
colores = {"muy_alta": (13, 71, 161, 170), "alta": (30, 136, 229, 135), "media": (100, 181, 246, 100)}
clase = np.full(h.shape, "", dtype=object)
dc = dist_cauce[zr0:zr1, zc0:zc1]; ruta = rutas[zr0:zr1, zc0:zc1]
for tope, nombre in reversed(NIVELES):
    clase[(h <= tope) & (dc <= DISTANCIA[nombre]) & ~agua & ~ruta] = nombre
for nombre, color in colores.items():
    img = np.zeros(h.shape + (4,), dtype=np.uint8); img[clase == nombre] = color
    grande = Image.fromarray(img, "RGBA").resize((h.shape[1] * 3, h.shape[0] * 3), Image.BILINEAR)
    grande.quantize(32, method=Image.Quantize.FASTOCTREE).save(os.path.join(SALIDA, f"riesgo-{nombre}.png"), optimize=True)

# Crecida del Paraná: la página inunda, desde el río, todo lo que esté por debajo del nivel elegido y conectado con él.
# Se guarda la cota de cada celda baja en una imagen sin pérdida: rojo = (cota - 95 m) x 4 (pasos de 25 cm; 255 = más alto
# que 158 m), verde = 255 en el cauce del río (punto de partida del agua), azul = 255 en lagos (no se pintan).
COTA_BASE = 95
cod = np.full(h.shape + (3,), 0, dtype=np.uint8)
cod[..., 0] = np.clip(np.round((z - COTA_BASE) * 4), 0, 255).astype(np.uint8)
cod[..., 0][z > COTA_BASE + 254 / 4] = 255
wbm_z = tifffile.imread(sys.argv[2])[r0:r1, c0:c1][zr0:zr1, zc0:zc1]
cod[..., 1][wbm_z == 3] = 255
cod[..., 2][wbm_z == 2] = 255
Image.fromarray(cod, "RGB").save(os.path.join(SALIDA, "cota.png"), optimize=True)

# Cauces como líneas (para dibujarlos encima)
red = grid.extract_river_network(fdir, Raster(cauces & (wbm_calc != 3), viewfinder=vf_b))
lineas = []
for f in red["features"]:
    pts = [[round(lat, 5), round(lng, 5)] for lng, lat in f["geometry"]["coordinates"]]
    # Se cortan los tramos que pasan por ríos y lagos (el Paraná ya se ve en el mapa) o fuera de la zona.
    tramo = []
    for q in pts + [None]:
        dentro = q is not None and lim[0][0] <= q[0] <= lim[1][0] and lim[0][1] <= q[1] <= lim[1][1]
        if dentro:
            i, j = int((lim[1][0] - q[0]) / paso), int((q[1] - lim[0][1]) / paso)
            dentro = not agua[min(i, agua.shape[0] - 1), min(j, agua.shape[1] - 1)]
        if dentro: tramo.append(q); continue
        if len(tramo) >= 2: lineas.append(tramo[::2] + ([tramo[-1]] if len(tramo) % 2 == 0 else []))
        tramo = []

# Ficha por barrio: qué parte de su área está en cada nivel (círculo de radio r del barrio, como en la página).
barrios = json.load(open(os.path.join(os.path.dirname(__file__), "barrios.json")))
lat_c = lim[1][0] - (np.arange(h.shape[0]) + .5) * paso; lng_c = lim[0][1] + (np.arange(h.shape[1]) + .5) * paso
LA, LO = np.meshgrid(lat_c, lng_c, indexing="ij")
fichas = []
for b in barrios:
    d = np.hypot((LA - b["c"][0]), (LO - b["c"][1]) * math.cos(math.radians(-25.52)))
    m = (d <= max(b["r"], .003)) & ~agua
    if m.sum() < 5: continue
    pct = {n: round(float((clase[m] == n).mean() * 100), 1) for _, n in NIVELES}
    expuesto = pct["muy_alta"] + pct["alta"] * .6 + pct["media"] * .25
    fichas.append({"n": b["n"], "c": b["c"], "r": b["r"], "pct": pct, "indice": round(expuesto, 1),
                   "hand_min": round(float(h[m].min()), 1), "cota": round(float(np.median(z[m])), 0)})
fichas.sort(key=lambda f: -f["indice"])

json.dump({
  "zona": lim, "niveles": [{"hasta_m": t_, "nombre": n, "a_menos_de_m": DISTANCIA[n]} for t_, n in NIVELES], "umbral_cauce_km2": UMBRAL_GRANDE_KM2,
  "barrios": fichas, "cauces": lineas, "cota_base": COTA_BASE, "celdas": list(h.shape),
  "fuente": os.environ.get("DEM_FUENTE", "Copernicus DEM GLO-30 (ESA / Unión Europea)") + ". Método HAND con pysheds"
            + (". Arroyos y ríos: © colaboradores de OpenStreetMap (ODbL)." if n_osm else "."),
  "arroyos_osm": n_osm,
  "modelo": os.environ.get("DEM_MODELO", "superficie"),
  "aviso": "Estimación a partir del relieve; no reemplaza un estudio hidrológico ni el mapa oficial de riesgo."
}, open(os.path.join(SALIDA, "datos.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("cauces", len(lineas), "barrios", len(fichas), "celdas", h.shape)
for f in fichas[:8]: print(f["n"], f["indice"], f["pct"])

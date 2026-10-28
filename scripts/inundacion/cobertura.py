"""Lee una ventana del mapa satelital de cobertura del suelo ESA WorldCover 10 m (2021) sin cargar la hoja entera.
Clases: 10 árboles, 20 arbustos, 30 pasto, 40 cultivos, 50 construido, 60 suelo desnudo, 80 agua, 90 humedal."""
import numpy as np, tifffile

def leer_ventana(ruta, norte, sur, oeste, este):
    t = tifffile.TiffFile(ruta); p = t.pages[0]
    paso = p.tags[33550].value[0]; x0, y0 = p.tags[33922].value[3], p.tags[33922].value[4]
    r0, r1 = int((y0 - norte) / paso), int(np.ceil((y0 - sur) / paso))
    c0, c1 = int((oeste - x0) / paso), int(np.ceil((este - x0) / paso))
    tw, tl = p.tilewidth, p.tilelength; ntx = (p.shape[1] + tw - 1) // tw
    out = np.zeros((r1 - r0, c1 - c0), dtype=np.uint8)
    fh = t.filehandle
    for ty in range(r0 // tl, (r1 - 1) // tl + 1):
        for tx in range(c0 // tw, (c1 - 1) // tw + 1):
            i = ty * ntx + tx
            fh.seek(p.dataoffsets[i]); datos = fh.read(p.databytecounts[i])
            bloque = p.decode(datos, i)[0].reshape(tl, tw)
            ya, xa = ty * tl, tx * tw
            ra, rb = max(r0, ya), min(r1, ya + tl); ca, cb = max(c0, xa), min(c1, xa + tw)
            out[ra - r0:rb - r0, ca - c0:cb - c0] = bloque[ra - ya:rb - ya, ca - xa:cb - xa]
    return out, paso, (y0 - r0 * paso, x0 + c0 * paso)

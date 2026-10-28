// Estilo del mapa de calles propio (colores, grosores y nombres). Lo usa scripts/dibujar-calles.mjs
// para dibujar las imágenes de calles/ que muestra la página. Datos: © colaboradores de OpenStreetMap (ODbL), vía OpenFreeMap.
window.estiloCalles = function(oscuro){
  const C = oscuro
    ? {tierra:"#1d2327", parque:"#1f3326", agua:"#1d4157", aguaTxt:"#8fbcd4", edif:"#262e33", calle:"#3b464d", calleBorde:"#151b1f",
       av:"#6b5a2e", avBorde:"#3a3120", ruta:"#7a4f2a", rutaBorde:"#45301b", txt:"#d5d9dc", halo:"#1d2327", barrio:"#9aa0a6"}
    : {tierra:"#f2efe9", parque:"#d6e8c9", agua:"#aad3df", aguaTxt:"#4a7f99", edif:"#e4dfd6", calle:"#ffffff", calleBorde:"#d4cfc4",
       av:"#fde293", avBorde:"#e3b55a", ruta:"#f9b26b", rutaBorde:"#d9853a", txt:"#3c4043", halo:"#ffffff", barrio:"#70757a"};

  // Grosor de cada tipo de calle según el zoom.
  const ancho = (z13, z16, z19, extra = [0, 0, 0]) => ["interpolate", ["exponential", 1.6], ["zoom"], 13, z13 + extra[0], 16, z16 + extra[1], 19, z19 + extra[2]];
  const tipo = (...c) => ["match", ["get", "class"], c, true, false];
  const CALLES = [
    {id:"menor", f:tipo("minor", "service", "track", "path", "pedestrian"), w:[.6, 4, 16], c:C.calle, b:C.calleBorde, min:14.5},
    {id:"terciaria", f:tipo("tertiary"), w:[1.2, 6, 20], c:C.calle, b:C.calleBorde, min:12},
    {id:"avenida", f:tipo("primary", "secondary"), w:[2.2, 8, 26], c:C.av, b:C.avBorde, min:10},
    {id:"ruta", f:tipo("trunk", "motorway"), w:[3, 10, 30], c:C.ruta, b:C.rutaBorde, min:8}
  ];
  const fuente = ["Noto Sans Regular"], negrita = ["Noto Sans Bold"];

  return {
    version:8,
    glyphs:"https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources:{
      osm:{type:"vector", url:"https://tiles.openfreemap.org/planet"}
    },
    layers:[
      {id:"fondo", type:"background", paint:{"background-color":C.tierra}},
      {id:"parques", type:"fill", source:"osm", "source-layer":"park", paint:{"fill-color":C.parque}},
      {id:"agua", type:"fill", source:"osm", "source-layer":"water", paint:{"fill-color":C.agua}},
      {id:"arroyos", type:"line", source:"osm", "source-layer":"waterway", paint:{"line-color":C.agua, "line-width":ancho(1, 2, 5)}},
      // Primero todos los bordes y después los rellenos, así los cruces quedan limpios.
      ...CALLES.map(k => ({id:k.id + "-borde", type:"line", source:"osm", "source-layer":"transportation", minzoom:k.min, filter:k.f,
        layout:{"line-cap":"round", "line-join":"round"}, paint:{"line-color":k.b, "line-width":ancho(...k.w, [.9, 1.6, 3])}})),
      ...CALLES.map(k => ({id:k.id, type:"line", source:"osm", "source-layer":"transportation", minzoom:k.min, filter:k.f,
        layout:{"line-cap":"round", "line-join":"round"}, paint:{"line-color":k.c, "line-width":ancho(...k.w)}})),
      {id:"nombres-agua", type:"symbol", source:"osm", "source-layer":"water_name",
        layout:{"text-field":["get", "name"], "text-font":fuente, "text-size":13, "text-letter-spacing":.2},
        paint:{"text-color":C.aguaTxt, "text-halo-color":C.halo, "text-halo-width":1}},
      {id:"nombres-calles", type:"symbol", source:"osm", "source-layer":"transportation_name", minzoom:15,
        layout:{"symbol-placement":"line", "text-field":["get", "name"], "text-size":["interpolate", ["linear"], ["zoom"], 14, 10, 18, 13],
          "text-font":["match", ["get", "class"], ["trunk", "primary", "secondary", "motorway"], ["literal", negrita], ["literal", fuente]], "text-max-angle":30, "symbol-spacing":300},
        paint:{"text-color":C.txt, "text-halo-color":C.halo, "text-halo-width":1.6}},
      {id:"barrios", type:"symbol", source:"osm", "source-layer":"place", filter:tipo("suburb", "neighbourhood", "quarter"), minzoom:13, maxzoom:17,
        layout:{"text-field":["get", "name"], "text-font":negrita, "text-size":12, "text-transform":"uppercase", "text-letter-spacing":.12, "text-max-width":8},
        paint:{"text-color":C.barrio, "text-halo-color":C.halo, "text-halo-width":1.5}},
      {id:"ciudades", type:"symbol", source:"osm", "source-layer":"place", filter:tipo("city", "town"),
        layout:{"text-field":["get", "name"], "text-font":negrita, "text-size":["interpolate", ["linear"], ["zoom"], 10, 13, 14, 18]},
        paint:{"text-color":C.txt, "text-halo-color":C.halo, "text-halo-width":2}},
    ]
  };
};

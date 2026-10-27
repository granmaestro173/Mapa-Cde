// Genera los datos de ejemplo para la presentación:
//   supabase/02-datos-ejemplo.sql  (para cargar en Supabase)
//   datos-ejemplo.json             (lo usa el modo sin servidor, para probar la página sin Supabase)
// Uso: node scripts/generar-ejemplos.mjs
import { writeFileSync } from "node:fs";
const DAY = 864e5, HOUR = 36e5;
const CAT_KEYS = ["bache","inundacion","animal","semaforo","inseguro","asalto","basura","alumbrado"];
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
function inPoly([y,x], poly){let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [yi,xi]=poly[i],[yj,xj]=poly[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins}return ins}
function riverWestLng(lat){for(let i=0;i<RIVER_W.length-1;i++){const [a1,b1]=RIVER_W[i],[a2,b2]=RIVER_W[i+1];if(lat<=a1&&lat>=a2)return b1+(b2-b1)*(lat-a1)/(a2-a1)}return -54.6}
const onLand = p => p[1] < riverWestLng(p[0]) - 0.0004 && !inPoly(p, LAKE);
function distM(a,b){const R=6371e3,r=Math.PI/180,dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r;const h=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
const nearestBarrio = p => BARRIOS.reduce((best,b)=>{const d=distM(p,b.c);return d<best.d?{d,n:b.n}:best},{d:Infinity,n:"—"}).n;
const DESCS = {
  bache:["Bache profundo en el carril derecho, ya reventó dos cubiertas","Pozo grande frente a la parada de colectivo","Hundimiento del asfalto después de la lluvia","Bache que ocupa media calzada, peligroso de noche","Varios baches seguidos en la esquina","Pozo con agua estancada, no se ve la profundidad"],
  inundacion:["Calle completamente inundada, el agua llega a la vereda","Raudal que no deja pasar autos","Desagüe tapado, se inunda con cualquier lluvia","Agua entrando a las casas de la cuadra","Cruce bajo inundado, motos varadas"],
  animal:["Perro muerto en la banquina hace dos días","Caballo muerto al costado de la ruta","Gato atropellado en la esquina","Animal muerto cerca de la escuela, mal olor"],
  semaforo:["Semáforo apagado en hora pico","Semáforo en amarillo intermitente todo el día","La luz verde no funciona","Semáforo dañado tras un choque","Semáforo peatonal sin funcionar"],
  inseguro:["Calle oscura donde roban a los que salen del trabajo","Terreno baldío usado para consumir drogas","Parada sin luz, varios arrebatos esta semana","Motochorros dando vueltas a la salida del colegio","Pasarela peligrosa de noche"],
  asalto:["Me arrebataron el celular dos personas en moto","Asalto a mano armada en la parada","Robaron la cartera a una señora","Asaltaron a un repartidor","Robo de moto a punta de arma","Arrebato de mochila a un estudiante"],
  basura:["Vertedero clandestino en el baldío","Basura acumulada hace una semana","Contenedor desbordado","Queman basura todas las noches"],
  alumbrado:["Toda la cuadra sin luz hace un mes","Columna de alumbrado caída","Foco quemado frente a la plaza","Luminaria encendida de día y apagada de noche"]
};

function prng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R = prng(20261027);
const gauss = () => {let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const pick = a => a[Math.floor(R()*a.length)];
const TOTALS = {bache:26,inundacion:10,animal:8,semaforo:10,inseguro:15,asalto:42,basura:14,alumbrado:12};
const STORMS = [3,11,26,44,61,90,118,150,185,220,250,290,330];

// Cada denuncia guarda "hace cuántos días" y la hora local, así los datos quedan frescos el día que se cargan.
let seq = 1000;
function make(cat, when){
  const weights = BARRIOS.map(b => b.w[cat] || .5), tot = weights.reduce((a,b)=>a+b,0);
  let x = R()*tot, b = BARRIOS[0];
  for (let i=0;i<BARRIOS.length;i++){ x -= weights[i]; if (x<=0){ b = BARRIOS[i]; break; } }
  let p; for (let k=0;k<30;k++){ p=[b.c[0]+gauss()*b.r, b.c[1]+gauss()*b.r*1.1]; if (onLand(p)) break; }
  const age = when.minsAgo != null ? when.minsAgo/1440 : when.days;
  let status = "recibida";
  if (age > 25) status = R() < .78 ? "resuelta" : (R()<.5?"en_proceso":"recibida");
  else if (age > 3) status = R() < .45 ? "en_proceso" : (R()<.3?"resuelta":"recibida");
  return {id:"E-"+(++seq), cat, lat:+p[0].toFixed(5), lng:+p[1].toFixed(5), when, desc:pick(DESCS[cat]), barrio:b.n, status,
    votes:Math.floor(R()**2*14), sev:1+Math.floor(R()*5), flags:0, conf:+(.62+R()*.3).toFixed(2)};
}
const out = [];
for (const cat of CAT_KEYS){
  for (let i=0;i<TOTALS[cat];i++){
    let days, h;
    if (cat==="inundacion"){ days = pick(STORMS); h = Math.floor(R()*24); }
    else {
      days = Math.max(1, Math.floor(Math.pow(R(),1.55)*365));
      h = (cat==="asalto"||cat==="inseguro") && R()<.62 ? 18+Math.floor(R()*6) : Math.floor(R()*24);
    }
    out.push(make(cat, {days, h, m:Math.floor(R()*60)}));
  }
}
for (const [cat,n] of [["asalto",2],["bache",2],["semaforo",1],["inseguro",1],["basura",1],["alumbrado",1]])
  for (let i=0;i<n;i++) out.push(make(cat, {minsAgo: 20 + Math.floor(R()*22*60)}));
// Algunas marcadas por vecinos como posiblemente falsas, para mostrar la moderación.
{ const R2 = prng(77); out.forEach(r => { if (R2() < .04) r.flags = 1 + Math.floor(R2()*4); }); }

// Obras de ejemplo con el mismo cálculo de costo de referencia que la página.
const P = {asfalto:2200000, liga:9000, hora:18500, camion:250000, rodillo:180000, diesel:7050, consumo:.35, gg:15, mat_semaforo:3800000, mat_alumbrado:1350000, mat_otro:900000};
const DEPOT = [-25.5032,-54.6338];
function refCost(o, r){
  let mat = 0;
  if (r.cat==="bache"){ const vol = o.m2*o.prof*1.1; mat = vol*P.asfalto + o.m2*P.liga; }
  else if (r.cat==="semaforo") mat = P.mat_semaforo;
  else if (r.cat==="alumbrado") mat = P.mat_alumbrado*o.unidades;
  else mat = P.mat_otro;
  const mo = o.personas*o.horas*P.hora, veh = o.horasVeh*(P.camion + (r.cat==="bache" ? P.rodillo : 0));
  const km = distM(DEPOT, [r.lat, r.lng])/1000*1.35*2, fuel = km*P.consumo*P.diesel*o.viajes;
  const sub = mat+mo+veh+fuel; return sub + sub*P.gg/100;
}
const CONTRATISTAS = ["Constructora Paraná S.A.","Vialtec del Este S.R.L.","Asfaltos Alto Paraná","Servicios Viales Monday","Electro Sur Ingeniería"];
const RESPONSABLES = ["Ing. A. Martínez · Obras Públicas","Arq. L. Giménez · Planificación Urbana","Ing. C. Duarte · Mantenimiento Vial","Lic. M. Ortiz · Servicios Urbanos"];
const markups = [1.04,.96,1.62,1.1,.92,1.21,1.08,2.05,1.02,.98];
const ageOf = r => r.when.minsAgo != null ? 0 : r.when.days;
const cands = out.filter(r => ["bache","semaforo","alumbrado"].includes(r.cat) && r.status!=="recibida").sort((a,b)=>ageOf(a)-ageOf(b));
const want = {bache:6, semaforo:2, alumbrado:2}, obras = [];
for (const r of cands) if (want[r.cat] > 0){
  want[r.cat]--; const i = obras.length;
  const o = {denuncia:r.id, contratista: r.cat==="bache" ? CONTRATISTAS[i%4] : CONTRATISTAS[4], responsable:RESPONSABLES[i%RESPONSABLES.length],
    fechaDias: r.status==="resuelta" ? -Math.floor(5+R()*20) : Math.floor(2+R()*20), estado: r.status==="resuelta" ? "Terminada" : "En ejecución",
    m2: r.cat==="bache" ? +(0.8+R()*3.5).toFixed(1) : null, prof:.07, personas: r.cat==="bache"?4:2, horas: r.cat==="bache"?5:3,
    horasVeh: r.cat==="bache"?2.5:(r.cat==="alumbrado"?2:1), viajes:1, unidades: r.cat==="alumbrado"?Math.ceil(R()*3):1};
  o.monto = Math.round(refCost(o, r) * markups[i % markups.length] / 1000) * 1000;
  obras.push(o);
}
const gs = n => "Gs. " + Math.round(n).toLocaleString("es-PY").replace(/,/g, ".");
const historial = obras.slice(0,5).map((o,i) => ({diasAtras:20-i*3, accion:`Obra asignada a ${o.denuncia}`, detalle:`${o.contratista} · ${gs(o.monto)}`}));
if (obras[2]) historial.push({diasAtras:2, accion:`Obra ${obras[2].denuncia} modificada`, detalle:`Monto: ${gs(Math.round(obras[2].monto*.8/1000)*1000)} → ${gs(obras[2].monto)}`});

// ---------- SQL ----------
const q = s => s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'";
const whenSql = w => w.minsAgo != null ? `now() - interval '${w.minsAgo} minutes'`
  : `least(now() - interval '10 minutes', ((date_trunc('day', now() at time zone 'America/Asuncion') - interval '${w.days} days' + interval '${w.h} hours ${w.m} minutes') at time zone 'America/Asuncion'))`;
let sql = `-- =====================================================================
-- Mapa Ciudadano CDE · Datos de ejemplo para la presentación (${out.length} denuncias, ${obras.length} obras)
-- Pegá este archivo en Supabase > SQL Editor y tocá "Run" DESPUÉS de 01-esquema.sql.
-- Las fechas se calculan desde el momento en que lo ejecutás. Para sacarlos: 03-borrar-ejemplos.sql
-- Archivo generado por scripts/generar-ejemplos.mjs
-- =====================================================================
begin;
delete from public.denuncias where demo;
insert into public.denuncias (id, categoria, lat, lng, creada, descripcion, barrio, estado, gravedad, clasificacion, votos, marcas, demo, autor) values
`;
sql += out.map(r => `  (${q(r.id)}, ${q(r.cat)}, ${r.lat}, ${r.lng}, ${whenSql(r.when)}, ${q(r.desc)}, ${q(r.barrio)}, ${q(r.status)}, ${r.sev}, '{"src":"ejemplo","conf":${r.conf}}', ${r.votes}, ${r.flags}, true, null)`).join(",\n") + ";\n\n";
sql += `-- Tiempo de resolución de ejemplo para las estadísticas.
update public.denuncias set resuelta_en = least(now(), creada + make_interval(days => 3 + votos % 9, hours => gravedad * 36))
 where demo and estado = 'resuelta';

`;
sql += `insert into public.obras (denuncia, contratista, responsable, fecha, estado, m2, prof, personas, horas, horas_veh, viajes, unidades, monto, demo) values\n`;
sql += obras.map(o => `  (${q(o.denuncia)}, ${q(o.contratista)}, ${q(o.responsable)}, current_date + ${o.fechaDias}, ${q(o.estado)}, ${o.m2 ?? "null"}, ${o.prof}, ${o.personas}, ${o.horas}, ${o.horasVeh}, ${o.viajes}, ${o.unidades}, ${o.monto}, true)`).join(",\n") + ";\n\n";
sql += `-- Historial de ejemplo (queda encadenado como cualquier otro registro).\n`;
sql += `do $$ begin\n  if not exists (select 1 from public.historial where demo) then\n`;
sql += historial.map(h => `    perform public.registrar(${q(h.accion)}, ${q(h.detalle)}, true, now() - interval '${h.diasAtras} days', 'Dirección de Obras Públicas');`).join("\n");
sql += `\n  end if;\nend $$;\ncommit;\n`;
writeFileSync(new URL("../supabase/02-datos-ejemplo.sql", import.meta.url), sql);
writeFileSync(new URL("../datos-ejemplo.json", import.meta.url), JSON.stringify({denuncias:out, obras, historial}));
console.log(`${out.length} denuncias, ${obras.length} obras, ${historial.length} registros de historial`);

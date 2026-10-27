/* Capa de datos del Mapa Ciudadano CDE.
   - Con Supabase configurado (config.js): denuncias, fotos, cuentas e historial reales, en tiempo real.
   - Sin configurar: modo de prueba con los datos de ejemplo, todo en memoria (sirve para mostrar la página sin servidor). */
(() => {
"use strict";
const DAY = 864e5;

// Base de datos (columnas en español) <-> objetos que usa la página.
const fromRow = d => ({
  id:d.id, cat:d.categoria, lat:+d.lat, lng:+d.lng, t:Date.parse(d.creada), desc:d.descripcion, barrio:d.barrio || "—",
  status:d.estado, sev:d.gravedad, ai:d.clasificacion || {}, mod:d.moderacion || "", hasPhoto:!!d.foto, photoOrig:!!d.foto_original,
  photoTaken:d.foto_tomada ? Date.parse(d.foto_tomada) : null, votes:d.votos || 0, flags:d.marcas || 0, demo:!!d.demo,
  resolvedAt:d.resuelta_en ? Date.parse(d.resuelta_en) : null, mine:false
});
const num = v => v == null || v === "" ? null : +v;
const fromObra = o => ({
  reportId:o.denuncia, contratista:o.contratista, responsable:o.responsable || "", fecha:String(o.fecha || "").slice(0,10), estado:o.estado,
  m2:num(o.m2), prof:num(o.prof), personas:num(o.personas), horas:num(o.horas), horasVeh:num(o.horas_veh), viajes:num(o.viajes),
  unidades:num(o.unidades), monto:+o.monto, fotoAntes:o.foto_antes || null, fotoDespues:o.foto_despues || null, demo:!!o.demo
});
const toObra = o => ({
  denuncia:o.reportId, contratista:o.contratista, responsable:o.responsable || null, fecha:o.fecha || null, estado:o.estado,
  m2:num(o.m2), prof:num(o.prof), personas:num(o.personas), horas:num(o.horas), horas_veh:num(o.horasVeh), viajes:num(o.viajes),
  unidades:num(o.unidades), monto:Math.round(+o.monto || 0), foto_antes:o.fotoAntes || null, foto_despues:o.fotoDespues || null
});
const fromAudit = h => ({id:h.id, t:Date.parse(h.t), who:h.quien, action:h.accion, detail:h.detalle, h:h.huella, prev:h.previa, demo:!!h.demo});
const fromParam = p => ({k:p.clave, n:p.nombre, v:+p.valor, o:p.orden});
// Mensajes de error de la base en palabras claras.
function nice(err){
  const m = err?.message || String(err || "");
  if (/row-level security|permission denied|42501/i.test(m)) return new Error("Tu cuenta no tiene permiso para hacer esto.");
  if (/Failed to fetch|NetworkError|network/i.test(m)) return new Error("Sin conexión. Revisá internet y probá de nuevo.");
  return new Error(m.replace(/^.*?:\s*/, "") || "Error inesperado.");
}

function supabaseStore(cfg, on){
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:"pkce"}});
  const base = cfg.supabaseUrl.replace(/\/$/, "");
  const S = {mode:"supabase", user:null};
  let channel = null, pollT = null;

  async function fetchAll(table, order, asc){
    const out = [];
    for (let from = 0; ; from += 1000){
      const {data, error} = await sb.from(table).select("*").order(order, {ascending:asc}).range(from, from + 999);
      if (error) throw error;
      out.push(...data); if (data.length < 1000 || out.length >= 20000) break;
    }
    return out;
  }
  async function loadReports(){ on.reports((await fetchAll("denuncias", "creada", false)).map(fromRow)); }
  async function loadObras(){ on.obras((await fetchAll("obras", "denuncia", true)).map(fromObra)); }
  async function loadAudit(){ on.audit((await fetchAll("historial", "id", true)).map(fromAudit)); }
  async function loadParams(){ const {data, error} = await sb.from("parametros").select("*").order("orden"); if (error) throw error; on.params(data.map(fromParam)); }
  async function loadAll(){
    try { await Promise.all([loadReports(), loadObras(), loadAudit(), loadParams()]); on.status("on", "En vivo"); }
    catch(err){ on.status("off", "Sin conexión"); on.error("No se pudieron cargar los datos: " + nice(err).message); }
  }
  async function loadUser(session){
    const u = session?.user;
    if (!u){ const was = S.user?.rol; S.user = null; on.user(null); if (S.started && was && was !== "vecino") loadReports().catch(() => {}); return; }
    let rol = "vecino", nombre = u.user_metadata?.full_name || "";
    const {data} = await sb.from("perfiles").select("rol,nombre").eq("id", u.id).maybeSingle();
    if (data){ rol = data.rol; nombre = data.nombre || nombre; }
    const prevRol = S.user ? S.user.rol : "vecino";
    S.user = {id:u.id, email:u.email || "", anon:!!u.is_anonymous, rol, nombre};
    on.user(S.user);
    // La moderación ve también las denuncias descartadas: al cambiar de rol se recarga la lista.
    if (S.started && prevRol !== rol) loadReports().catch(() => {});
    return S.user;
  }
  function subscribe(){
    if (channel) sb.removeChannel(channel);
    channel = sb.channel("cde-cambios")
      .on("postgres_changes", {event:"*", schema:"public", table:"denuncias"}, p => {
        if (p.eventType === "DELETE") on.report({id:p.old.id}, true);
        else { const r = fromRow(p.new); on.report(r, r.mod === "falsa" && !["moderador","municipal","admin"].includes(S.user?.rol)); }
      })
      .on("postgres_changes", {event:"*", schema:"public", table:"obras"}, () => loadObras().catch(() => {}))
      .on("postgres_changes", {event:"INSERT", schema:"public", table:"historial"}, () => loadAudit().catch(() => {}))
      .on("postgres_changes", {event:"UPDATE", schema:"public", table:"parametros"}, () => loadParams().catch(() => {}))
      .subscribe(st => {
        if (st === "SUBSCRIBED") on.status("on", "En vivo");
        else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") on.status("off", "Reconectando…");
      });
  }
  // Algunos cambios no llegan por tiempo real (por ejemplo, una denuncia que pasa a falsa deja de ser visible
  // para el público): cada 2 minutos, con la pestaña visible, se vuelve a pedir la lista.
  function poll(){ clearInterval(pollT); pollT = setInterval(() => { if (!document.hidden) loadReports().catch(() => {}); }, 120000); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadReports().catch(() => {}); });

  // Sesión para escribir: los vecinos entran como anónimos sin hacer nada; si eso está apagado, se pide ingresar.
  async function ensureSession(){
    const {data:{session}} = await sb.auth.getSession();
    if (session) return session;
    const {data, error} = await sb.auth.signInAnonymously();
    if (error){ const e = new Error("Para participar, ingresá con tu email."); e.needLogin = true; throw e; }
    return data.session;
  }

  S.start = async () => {
    on.status("off", "Conectando…");
    const {data:{session}} = await sb.auth.getSession();
    await loadUser(session).catch(() => {});
    await loadAll(); subscribe(); poll(); S.started = true;
    sb.auth.onAuthStateChange((ev, s) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED") setTimeout(() => { loadUser(s).catch(() => {}); if (ev !== "USER_UPDATED") subscribe(); }, 0);
    });
  };
  S.accessToken = async () => { try { return (await ensureSession()).access_token; } catch(e){ return null; } };
  S.signInEmail = async email => {
    const {error} = await sb.auth.signInWithOtp({email, options:{emailRedirectTo:location.origin + location.pathname, shouldCreateUser:true}});
    if (error) throw nice(error);
  };
  S.signInPassword = async (email, password) => {
    const {error} = await sb.auth.signInWithPassword({email, password});
    if (error) throw new Error(/invalid/i.test(error.message) ? "Email o contraseña incorrectos." : nice(error).message);
  };
  S.signInGoogle = async () => {
    const {error} = await sb.auth.signInWithOAuth({provider:"google", options:{redirectTo:location.origin + location.pathname}});
    if (error) throw nice(error);
  };
  S.signOut = async () => { await sb.auth.signOut(); };
  S.signInAs = async () => {};

  S.createReport = async (rec, photo) => {
    await ensureSession();
    const {data, error} = await sb.from("denuncias").insert({
      categoria:rec.cat, lat:rec.lat, lng:rec.lng, descripcion:rec.desc, barrio:rec.barrio, gravedad:rec.sev,
      clasificacion:rec.ai, foto_tomada:rec.photoTaken ? new Date(rec.photoTaken).toISOString() : null
    }).select().single();
    if (error) throw nice(error);
    let warn = null, row = data;
    if (photo){
      // Copia liviana pública para el mapa y original intacto en el almacén privado.
      const ext = photo.blob.type === "image/webp" ? "webp" : "jpg";
      const up = await sb.storage.from("fotos").upload(`${data.id}.${ext}`, photo.blob, {contentType:photo.blob.type, cacheControl:"31536000", upsert:false});
      if (up.error) warn = "La denuncia se envió, pero la foto no se pudo subir.";
      const f = photo.file, okType = /^image\/(jpeg|png|webp|heic|heif|avif|gif)$/.test(f?.type || "");
      if (cfg.originales !== false && f && okType && f.size <= 15 * 1024 * 1024){
        const oext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        await sb.storage.from("originales").upload(`${data.id}.${oext}`, f, {contentType:f.type, upsert:false}).catch(() => {});
      }
      await sb.rpc("confirmar_foto", {p_denuncia:data.id});
      const again = await sb.from("denuncias").select("*").eq("id", data.id).single();
      if (!again.error) row = again.data;
    }
    const r = fromRow(row); r.mine = true;
    return {report:r, warn};
  };
  S.updateReport = async (id, patch) => {
    const upd = {};
    if ("status" in patch) upd.estado = patch.status;
    if ("mod" in patch) upd.moderacion = patch.mod || null;
    const {data, error} = await sb.from("denuncias").update(upd).eq("id", id).select().maybeSingle();
    if (error) throw nice(error);
    if (!data) throw new Error("Tu cuenta no tiene permiso para hacer esto.");
    return fromRow(data);
  };
  S.vote = async (id, kind) => {
    await ensureSession();
    const {data, error} = await sb.rpc("votar", {p_denuncia:id, p_tipo:kind});
    if (error) throw nice(error);
    return data;
  };
  S.photoUrl = (r, alt) => `${base}/storage/v1/object/public/fotos/${encodeURIComponent(r.id)}.${alt ? "jpg" : "webp"}`;
  S.originalUrl = async r => {
    const {data, error} = await sb.storage.from("originales").list("", {search:r.id, limit:5});
    if (error || !data?.length) throw new Error("No se encontró el original.");
    const s = await sb.storage.from("originales").createSignedUrl(data[0].name, 600);
    if (s.error) throw nice(s.error);
    return s.data.signedUrl;
  };
  // Insertar o actualizar por separado (no upsert), así el historial registra "asignada" o "modificada" una sola vez.
  S.saveObra = async (o, prev) => {
    const row = toObra(o);
    const {data, error} = prev
      ? await sb.from("obras").update(row).eq("denuncia", o.reportId).select()
      : await sb.from("obras").insert(row).select();
    if (error) throw nice(error);
    if (!data?.length) throw new Error("Tu cuenta no tiene permiso para hacer esto.");
  };
  S.setParam = async (k, v) => {
    const {data, error} = await sb.from("parametros").update({valor:v}).eq("clave", k).select();
    if (error) throw nice(error);
    if (!data?.length) throw new Error("Tu cuenta no tiene permiso para hacer esto.");
  };
  S.verifyAudit = async () => {
    const {data, error} = await sb.rpc("verificar_historial");
    if (error) throw nice(error);
    return data || [];
  };
  return S;
}

// ---------- Modo de prueba (sin servidor) ----------
function localStore(cfg, on){
  const S = {mode:"local", user:null};
  const reports = new Map(), obras = new Map(), audit = [], params = [];
  const PARAMS = [["asfalto","Mezcla asfáltica en caliente (Gs/m³)",2200000],["liga","Riego de liga (Gs/m²)",9000],["hora","Mano de obra (Gs/hora, con cargas)",18500],["camion","Camión volquete (Gs/hora)",250000],["rodillo","Rodillo compactador (Gs/hora)",180000],["diesel","Diésel tipo III (Gs/litro)",7050],["consumo","Consumo camión (litros/km)",.35],["gg","Gastos generales y utilidad (%)",15],["mat_semaforo","Módulo semafórico LED (Gs)",3800000],["mat_alumbrado","Luminaria LED 100 W (Gs)",1350000],["mat_otro","Materiales varios (Gs)",900000]];
  PARAMS.forEach(([k,n,v],i) => params.push({k, n, v, o:i+1}));
  async function sha(s){
    if (!crypto.subtle) return Math.abs([...s].reduce((h,c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 7)).toString(16).padStart(64, "0");
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  async function log(action, detail, t = Date.now(), who, demo = false){
    const prev = audit.length ? audit[audit.length-1].h : "0".repeat(64);
    audit.push({id:audit.length+1, t, who:who || (S.user ? {municipal:"Municipalidad CDE (prueba)", moderador:"Moderación (prueba)"}[S.user.rol] : "Vecino"), action, detail, prev, h:await sha(prev + "|" + t + "|" + action + "|" + detail), demo});
    on.audit(audit.slice());
  }
  const emit = () => { on.reports([...reports.values()].filter(r => r.mod !== "falsa" || ["moderador","municipal"].includes(S.user?.rol))); };

  S.start = async () => {
    on.status("off", "Modo de prueba");
    on.params(params); on.user(null);
    try {
      const j = await (await fetch(cfg.ejemplos || "datos-ejemplo.json")).json();
      const today = new Date(); today.setHours(0,0,0,0);
      const now = Date.now();
      for (const d of j.denuncias){
        const t = d.when.minsAgo != null ? now - d.when.minsAgo*6e4 : Math.min(now - 6e5, today.getTime() - d.when.days*DAY + (d.when.h*60 + d.when.m)*6e4);
        reports.set(d.id, {id:d.id, cat:d.cat, lat:d.lat, lng:d.lng, t, desc:d.desc, barrio:d.barrio, status:d.status, sev:d.sev, ai:{src:"ejemplo", conf:d.conf}, mod:"", hasPhoto:false, photoOrig:false, photoTaken:null, votes:d.votes, flags:d.flags, demo:true,
          resolvedAt:d.status === "resuelta" ? Math.min(now, t + (3 + d.votes % 9)*DAY + d.sev*36*36e5) : null});
      }
      for (const o of j.obras) obras.set(o.denuncia, {reportId:o.denuncia, contratista:o.contratista, responsable:o.responsable, fecha:new Date(now + o.fechaDias*DAY).toISOString().slice(0,10), estado:o.estado, m2:o.m2, prof:o.prof, personas:o.personas, horas:o.horas, horasVeh:o.horasVeh, viajes:o.viajes, unidades:o.unidades, monto:o.monto, demo:true});
      for (const h of j.historial) await log(h.accion, h.detalle, now - h.diasAtras*DAY, "Dirección de Obras Públicas", true);
    } catch(e){ on.error("No se pudieron cargar los datos de ejemplo."); }
    emit(); on.obras([...obras.values()]);
  };
  S.accessToken = async () => null;
  S.signInEmail = async () => { throw new Error("En el modo de prueba no hay cuentas reales."); };
  S.signInGoogle = S.signInEmail; S.signInPassword = S.signInEmail;
  S.signInAs = async rol => { S.user = {id:"prueba", email:"", anon:false, rol, nombre:rol === "municipal" ? "Municipalidad CDE (prueba)" : "Moderación (prueba)"}; on.user(S.user); emit(); };
  S.signOut = async () => { S.user = null; on.user(null); emit(); };
  S.createReport = async (rec, photo) => {
    const id = "D-" + Math.random().toString(16).slice(2, 8).toUpperCase();
    const r = {id, cat:rec.cat, lat:rec.lat, lng:rec.lng, t:Date.now(), desc:rec.desc, barrio:rec.barrio, status:"recibida", sev:rec.sev, ai:rec.ai, mod:"", hasPhoto:!!photo, photo:photo?.dataUrl || null, photoOrig:false, photoTaken:rec.photoTaken, votes:0, flags:0, demo:false, resolvedAt:null, mine:true};
    reports.set(id, r);
    return {report:r, warn:null};
  };
  const LBL = {recibida:"Recibida", en_proceso:"En proceso", resuelta:"Resuelta"};
  S.updateReport = async (id, patch) => {
    const r = reports.get(id), rol = S.user?.rol;
    if (!["moderador","municipal"].includes(rol) || ("status" in patch && rol !== "municipal")) throw new Error("Tu cuenta no tiene permiso para hacer esto.");
    if ("mod" in patch && patch.mod !== r.mod) await log("Moderación de " + id, patch.mod === "verificada" ? "Verificada" : patch.mod === "falsa" ? "Marcada como falsa" : "Marca quitada");
    if ("status" in patch && patch.status !== r.status){ await log("Estado de " + id, LBL[r.status] + " → " + LBL[patch.status]); r.resolvedAt = patch.status === "resuelta" ? Date.now() : null; }
    Object.assign(r, patch);
    setTimeout(emit, 0);
    return r;
  };
  const voted = new Set();
  S.vote = async (id, kind) => {
    if (voted.has(id + kind)) return null; voted.add(id + kind);
    const r = reports.get(id); if (kind === "confirma") return ++r.votes; return ++r.flags;
  };
  S.photoUrl = r => r.photo || "";
  S.originalUrl = async () => { throw new Error("En el modo de prueba no se guardan originales."); };
  S.saveObra = async (o, prev, changes) => {
    if (S.user?.rol !== "municipal") throw new Error("Tu cuenta no tiene permiso para hacer esto.");
    obras.set(o.reportId, o);
    if (changes?.length) await log(prev ? `Obra ${o.reportId} modificada` : `Obra asignada a ${o.reportId}`, changes.join(" · "));
    on.obras([...obras.values()]);
  };
  S.setParam = async (k, v) => {
    if (S.user?.rol !== "municipal") throw new Error("Tu cuenta no tiene permiso para hacer esto.");
    const p = params.find(x => x.k === k); const old = p.v; p.v = v;
    await log("Precio de referencia", `${p.n}: ${old} → ${v}`);
  };
  S.verifyAudit = async () => {
    const bad = []; let prev = "0".repeat(64);
    for (const e of audit){
      if (e.prev !== prev) bad.push({id:e.id, motivo:"cadena rota"});
      else if (e.h !== await sha(e.prev + "|" + e.t + "|" + e.action + "|" + e.detail)) bad.push({id:e.id, motivo:"contenido alterado"});
      prev = e.h;
    }
    return bad;
  };
  return S;
}

window.CDEStore = {
  create(cfg, on){
    return cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase ? supabaseStore(cfg, on) : localStore(cfg, on);
  }
};
})();

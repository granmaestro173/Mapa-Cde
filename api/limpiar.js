// Función del servidor (Vercel) que limpia el mapa. La llama Supabase una vez por día (06-limpiar-resueltas.sql).
// Borra las denuncias resueltas hace más de 2 semanas y después sus fotos, que solo se pueden borrar por la API de Storage.
//
// Usa las mismas variables de entorno que api/verificar.js: SUPABASE_URL, SUPABASE_ANON_KEY e IA_CLAVE.

async function supabase(ruta, opciones){
  const key = process.env.SUPABASE_ANON_KEY;
  const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, "") + ruta, {...opciones,
    headers:{apikey:key, authorization:"Bearer " + key, "content-type":"application/json"}});
  if (!r.ok) throw new Error(`Supabase ${ruta}: ${r.status} ${await r.text()}`);
  return r.json();
}

export default async function handler(req, res){
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({error:"Método no permitido."});
  const clave = process.env.IA_CLAVE;
  if (!clave || req.headers["x-clave"] !== clave) return res.status(401).json({error:"Clave inválida."});
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return res.status(503).json({error:"Faltan variables de entorno en Vercel."});

  // Borra las denuncias vencidas y devuelve las fotos que quedaron sin denuncia.
  const fotos = await supabase("/rest/v1/rpc/limpiar_resueltas", {method:"POST", body:JSON.stringify({p_clave:clave})});
  const porBucket = {};
  for (const f of fotos) (porBucket[f.bucket] ||= []).push(f.nombre);
  let borradas = 0;
  for (const [bucket, nombres] of Object.entries(porBucket)){
    const r = await supabase("/storage/v1/object/" + bucket, {method:"DELETE", body:JSON.stringify({prefixes:nombres})});
    borradas += Array.isArray(r) ? r.length : 0;
  }
  return res.status(200).json({fotos_borradas:borradas, fotos_pendientes:fotos.length - borradas});
}

-- =====================================================================
-- Mapa Ciudadano CDE · Esquema de base de datos para Supabase
-- Pegá TODO este archivo en Supabase > SQL Editor > New query y tocá "Run".
-- Se puede volver a ejecutar sin romper nada (crea lo que falta).
-- =====================================================================

-- ---------- Perfiles y roles ----------
-- Cada cuenta (incluidas las anónimas de los vecinos) tiene un perfil.
-- Roles: vecino (por defecto), moderador (verifica o descarta denuncias),
--        municipal (además cambia estados, carga obras y precios), admin.
create table if not exists public.perfiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  nombre  text,
  rol     text not null default 'vecino' check (rol in ('vecino','moderador','municipal','admin')),
  creado  timestamptz not null default now()
);

create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select rol from public.perfiles where id = auth.uid()), 'vecino')
$$;
create or replace function public.es_staff() returns boolean
language sql stable as $$ select public.mi_rol() in ('moderador','municipal','admin') $$;
create or replace function public.es_municipal() returns boolean
language sql stable as $$ select public.mi_rol() in ('municipal','admin') $$;

-- Crea el perfil automáticamente cuando alguien se registra o entra por primera vez.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();
insert into public.perfiles (id) select id from auth.users on conflict (id) do nothing;

-- ---------- Denuncias ----------
create table if not exists public.denuncias (
  id             text primary key default ('D-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  categoria      text not null check (categoria in ('bache','inundacion','animal','semaforo','inseguro','asalto','basura','alumbrado')),
  lat            double precision not null check (lat between -25.60 and -25.44),
  lng            double precision not null check (lng between -54.73 and -54.57),
  creada         timestamptz not null default now(),
  descripcion    text not null check (char_length(descripcion) between 3 and 500),
  barrio         text check (char_length(barrio) <= 60),
  estado         text not null default 'recibida' check (estado in ('recibida','en_proceso','resuelta')),
  gravedad       smallint not null default 3 check (gravedad between 1 and 5),
  clasificacion  jsonb not null default '{}'::jsonb,   -- {src, conf, resumen, area_m2}
  moderacion     text check (moderacion in ('verificada','falsa')),
  foto           boolean not null default false,       -- hay copia liviana en el bucket "fotos"
  foto_original  boolean not null default false,       -- hay original en el bucket privado "originales"
  foto_tomada    timestamptz,
  resuelta_en    timestamptz,                          -- se completa sola al pasar a "resuelta"
  votos          integer not null default 0,
  marcas         integer not null default 0,
  demo           boolean not null default false,       -- datos de ejemplo para la presentación
  autor          uuid default auth.uid(),
  actualizada    timestamptz not null default now()
);
alter table public.denuncias add column if not exists resuelta_en timestamptz;
create index if not exists denuncias_creada_idx on public.denuncias (creada desc);
create index if not exists denuncias_autor_idx on public.denuncias (autor, creada desc);

-- Confirmaciones ("yo también lo vi") y marcas ("parece falsa"): una por persona y denuncia.
create table if not exists public.votos (
  denuncia  text not null references public.denuncias(id) on delete cascade,
  usuario   uuid not null,
  tipo      text not null check (tipo in ('confirma','falsa')),
  creado    timestamptz not null default now(),
  primary key (denuncia, usuario, tipo)
);

-- ---------- Obras municipales ----------
create table if not exists public.obras (
  denuncia      text primary key references public.denuncias(id) on delete cascade,
  contratista   text not null check (char_length(contratista) <= 120),
  responsable   text check (char_length(responsable) <= 120),
  fecha         date,
  estado        text not null default 'Planificada' check (estado in ('Planificada','En ejecución','Terminada')),
  m2            numeric, prof numeric, personas numeric, horas numeric, horas_veh numeric, viajes numeric, unidades numeric,
  monto         bigint not null check (monto >= 0),
  foto_antes    text check (char_length(foto_antes) < 200000),
  foto_despues  text check (char_length(foto_despues) < 200000),
  demo          boolean not null default false,
  actualizada   timestamptz not null default now()
);

-- ---------- Precios de referencia ----------
create table if not exists public.parametros (
  clave   text primary key,
  nombre  text not null,
  valor   numeric not null,
  orden   integer not null default 0
);
insert into public.parametros (clave, nombre, valor, orden) values
  ('asfalto','Mezcla asfáltica en caliente (Gs/m³)',2200000,1),
  ('liga','Riego de liga (Gs/m²)',9000,2),
  ('hora','Mano de obra (Gs/hora, con cargas)',18500,3),
  ('camion','Camión volquete (Gs/hora)',250000,4),
  ('rodillo','Rodillo compactador (Gs/hora)',180000,5),
  ('diesel','Diésel tipo III (Gs/litro)',7050,6),
  ('consumo','Consumo camión (litros/km)',0.35,7),
  ('gg','Gastos generales y utilidad (%)',15,8),
  ('mat_semaforo','Módulo semafórico LED (Gs)',3800000,9),
  ('mat_alumbrado','Luminaria LED 100 W (Gs)',1350000,10),
  ('mat_otro','Materiales varios (Gs)',900000,11)
on conflict (clave) do nothing;

-- ---------- Historial con huella encadenada (no se puede editar ni borrar desde la app) ----------
create table if not exists public.historial (
  id       bigserial primary key,
  t        timestamptz not null default now(),
  quien    text not null,
  accion   text not null,
  detalle  text not null default '',
  previa   text not null,
  huella   text not null,
  demo     boolean not null default false
);

create or replace function public.quien_soy() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(nullif(nombre, ''), case rol when 'municipal' then 'Municipalidad CDE' when 'moderador' then 'Moderación' when 'admin' then 'Administración' else 'Vecino' end)
       from public.perfiles where id = auth.uid()),
    'Sistema')
$$;

-- Cada fila guarda la huella SHA-256 de la anterior: si alguien altera una fila vieja, la cadena deja de cerrar.
create or replace function public.huella_de(p_previa text, p_t timestamptz, p_accion text, p_detalle text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(
    p_previa || '|' || to_char(p_t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' || p_accion || '|' || coalesce(p_detalle, ''),
    'UTF8')), 'hex')
$$;

create or replace function public.registrar(p_accion text, p_detalle text, p_demo boolean default false, p_t timestamptz default now(), p_quien text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_prev text;
begin
  perform pg_advisory_xact_lock(424242);
  select huella into v_prev from public.historial order by id desc limit 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  insert into public.historial (t, quien, accion, detalle, previa, huella, demo)
  values (p_t, coalesce(p_quien, public.quien_soy()), p_accion, coalesce(p_detalle, ''), v_prev,
          public.huella_de(v_prev, p_t, p_accion, p_detalle), p_demo);
end $$;
revoke execute on function public.registrar(text, text, boolean, timestamptz, text) from public, anon, authenticated;

-- Verifica la cadena completa. Devuelve las filas con problemas (vacío = todo en orden).
create or replace function public.verificar_historial() returns table (id bigint, motivo text)
language sql stable security definer set search_path = public as $$
  with h as (
    select h.*, lag(h.huella) over (order by h.id) as huella_anterior from public.historial h
  )
  select h.id, case when h.previa <> coalesce(h.huella_anterior, repeat('0', 64)) then 'cadena rota' else 'contenido alterado' end
  from h
  where h.previa <> coalesce(h.huella_anterior, repeat('0', 64))
     or h.huella <> public.huella_de(h.previa, h.t, h.accion, h.detalle)
$$;
grant execute on function public.verificar_historial() to anon, authenticated;

-- ---------- Reglas automáticas sobre las denuncias ----------
-- ¿La operación viene de la app (vecino o municipalidad) o del SQL Editor / servidor?
-- Las llamadas de la app llevan el token de Supabase (rol anon o authenticated); el SQL Editor no.
create or replace function public.desde_la_app() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') in ('anon', 'authenticated')
$$;

create or replace function public.denuncias_antes_insertar() returns trigger
language plpgsql as $$
declare v_recientes int;
begin
  if not public.desde_la_app() then return new; end if;
  -- Un vecino no puede crear denuncias ya resueltas, verificadas, con votos ni de ejemplo.
  new.autor := auth.uid();
  new.creada := now();
  new.actualizada := now();
  new.estado := 'recibida';
  new.moderacion := null;
  new.votos := 0;
  new.marcas := 0;
  new.foto := false;
  new.foto_original := false;
  new.resuelta_en := null;
  new.demo := false;
  if new.foto_tomada is not null and new.foto_tomada > now() then new.foto_tomada := now(); end if;
  -- Freno al spam: hasta 10 denuncias por hora por persona.
  select count(*) into v_recientes from public.denuncias
   where autor = auth.uid() and creada > now() - interval '1 hour';
  if v_recientes >= 10 then
    raise exception 'Enviaste muchas denuncias seguidas. Probá de nuevo en un rato.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists denuncias_antes_insertar on public.denuncias;
create trigger denuncias_antes_insertar before insert on public.denuncias
  for each row execute function public.denuncias_antes_insertar();

create or replace function public.denuncias_antes_actualizar() returns trigger
language plpgsql as $$
begin
  new.actualizada := now();
  if not public.desde_la_app() or current_setting('cde.rpc', true) = '1' then return new; end if;
  -- Desde la app solo se cambian el estado y la moderación. El resto queda como lo cargó el vecino.
  new.id := old.id; new.categoria := old.categoria; new.lat := old.lat; new.lng := old.lng;
  new.creada := old.creada; new.descripcion := old.descripcion; new.barrio := old.barrio;
  new.gravedad := old.gravedad; new.clasificacion := old.clasificacion; new.foto := old.foto;
  new.foto_original := old.foto_original; new.foto_tomada := old.foto_tomada;
  new.votos := old.votos; new.marcas := old.marcas; new.demo := old.demo; new.autor := old.autor;
  if new.estado is distinct from old.estado and not public.es_municipal() then
    raise exception 'Solo la municipalidad puede cambiar el estado de una denuncia.' using errcode = '42501';
  end if;
  if new.estado = 'resuelta' and old.estado <> 'resuelta' then new.resuelta_en := now();
  elsif new.estado <> 'resuelta' then new.resuelta_en := null; end if;
  return new;
end $$;
drop trigger if exists denuncias_antes_actualizar on public.denuncias;
create trigger denuncias_antes_actualizar before update on public.denuncias
  for each row execute function public.denuncias_antes_actualizar();

create or replace function public.denuncias_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare lbl jsonb := '{"recibida":"Recibida","en_proceso":"En proceso","resuelta":"Resuelta"}';
begin
  if not public.desde_la_app() then return new; end if;
  if new.moderacion is distinct from old.moderacion then
    perform public.registrar('Moderación de ' || new.id,
      case new.moderacion when 'verificada' then 'Verificada' when 'falsa' then 'Marcada como falsa' else 'Marca quitada' end);
  end if;
  if new.estado is distinct from old.estado then
    perform public.registrar('Estado de ' || new.id, (lbl->>old.estado) || ' → ' || (lbl->>new.estado));
  end if;
  return new;
end $$;
drop trigger if exists denuncias_auditar on public.denuncias;
create trigger denuncias_auditar after update on public.denuncias
  for each row execute function public.denuncias_auditar();

-- ---------- Acciones de los vecinos (funciones con permisos controlados) ----------
-- "Yo también lo vi" o "Parece falsa". Devuelve el nuevo total, o null si esa persona ya lo había hecho.
create or replace function public.votar(p_denuncia text, p_tipo text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  if auth.uid() is null then raise exception 'Necesitás una sesión para votar.' using errcode = '42501'; end if;
  if p_tipo not in ('confirma','falsa') then raise exception 'Tipo de voto inválido.'; end if;
  insert into public.votos (denuncia, usuario, tipo) values (p_denuncia, auth.uid(), p_tipo)
  on conflict do nothing;
  if not found then return null; end if;
  perform set_config('cde.rpc', '1', true);
  if p_tipo = 'confirma' then
    update public.denuncias set votos = votos + 1 where id = p_denuncia returning votos into v_total;
  else
    update public.denuncias set marcas = marcas + 1 where id = p_denuncia returning marcas into v_total;
  end if;
  perform set_config('cde.rpc', '0', true);
  return v_total;
end $$;
revoke execute on function public.votar(text, text) from public, anon;
grant execute on function public.votar(text, text) to authenticated;

-- Deshacer "Yo también lo vi" o "Parece falsa" (por si se tocó por error). Devuelve el nuevo total, o null si no había voto.
create or replace function public.quitar_voto(p_denuncia text, p_tipo text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  if auth.uid() is null then raise exception 'Necesitás una sesión para votar.' using errcode = '42501'; end if;
  if p_tipo not in ('confirma','falsa') then raise exception 'Tipo de voto inválido.'; end if;
  delete from public.votos where denuncia = p_denuncia and usuario = auth.uid() and tipo = p_tipo;
  if not found then return null; end if;
  perform set_config('cde.rpc', '1', true);
  if p_tipo = 'confirma' then
    update public.denuncias set votos = greatest(votos - 1, 0) where id = p_denuncia returning votos into v_total;
  else
    update public.denuncias set marcas = greatest(marcas - 1, 0) where id = p_denuncia returning marcas into v_total;
  end if;
  perform set_config('cde.rpc', '0', true);
  return v_total;
end $$;
revoke execute on function public.quitar_voto(text, text) from public, anon;
grant execute on function public.quitar_voto(text, text) to authenticated;

-- ---------- Verificación automática con IA ----------
-- Cada denuncia nueva con foto la revisa Claude una vez: si la foto coincide con lo denunciado queda "verificada";
-- si no, "dudosa" (eso solo lo ve la moderación). Las denuncias sin foto no se escanean.
alter table public.denuncias add column if not exists ia_estado text check (ia_estado in ('verificada','dudosa','sin_foto','error'));
alter table public.denuncias add column if not exists ia_motivo text;
alter table public.denuncias add column if not exists ia_revisada timestamptz;
create index if not exists denuncias_ia_pendientes_idx on public.denuncias (creada) where ia_revisada is null;

-- La clave que comparten Supabase y la función de Vercel. Vive en un esquema privado: ni vecinos ni visitantes la leen.
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
create table if not exists privado.ajustes (clave text primary key, valor text not null);
insert into privado.ajustes (clave, valor)
values ('ia_clave', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (clave) do nothing;

-- Nadie puede escribir el resultado de la IA desde la página: solo la función ia_guardar.
create or replace function public.denuncias_proteger_ia() returns trigger
language plpgsql as $$
begin
  if not public.desde_la_app() or current_setting('cde.rpc', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.ia_estado := null; new.ia_motivo := null; new.ia_revisada := null;
  else
    new.ia_estado := old.ia_estado; new.ia_motivo := old.ia_motivo; new.ia_revisada := old.ia_revisada;
  end if;
  return new;
end $$;
drop trigger if exists denuncias_proteger_ia on public.denuncias;
create trigger denuncias_proteger_ia before insert or update on public.denuncias
  for each row execute function public.denuncias_proteger_ia();

create or replace function public.ia_clave_valida(p_clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_clave, '') <> '' and exists (select 1 from privado.ajustes where clave = 'ia_clave' and valor = p_clave);
$$;
revoke execute on function public.ia_clave_valida(text) from public, anon, authenticated;

-- Denuncias con foto que todavía no revisó la IA. Las que no tienen foto no se escanean.
create or replace function public.ia_pendientes(p_clave text, p_limite int default 8)
returns table (id text, categoria text, descripcion text, barrio text, foto text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  return query
    select d.id, d.categoria, d.descripcion, d.barrio,
           case when d.foto then (select o.name from storage.objects o where o.bucket_id = 'fotos' and o.name like d.id || '.%' order by o.name desc limit 1) end
      from public.denuncias d
     where d.ia_revisada is null and not d.demo and coalesce(d.moderacion, '') <> 'falsa'
       and d.foto
     order by d.creada
     limit least(greatest(coalesce(p_limite, 8), 1), 20);
end $$;
revoke execute on function public.ia_pendientes(text, int) from public;
grant execute on function public.ia_pendientes(text, int) to anon, authenticated;

create or replace function public.ia_guardar(p_clave text, p_id text, p_estado text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  if p_estado not in ('verificada','dudosa','sin_foto','error') then raise exception 'Resultado inválido.'; end if;
  perform set_config('cde.rpc', '1', true);
  update public.denuncias
     set ia_estado = p_estado, ia_motivo = left(p_motivo, 300), ia_revisada = now()
   where id = p_id;
  perform set_config('cde.rpc', '0', true);
end $$;
revoke execute on function public.ia_guardar(text, text, text, text) from public;
grant execute on function public.ia_guardar(text, text, text, text) to anon, authenticated;

-- Avisa que la foto ya se subió. Solo el autor de la denuncia, y solo si el archivo existe de verdad.
create or replace function public.confirmar_foto(p_denuncia text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('cde.rpc', '1', true);
  update public.denuncias d set
    foto = exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = d.id || '.webp')
        or exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = d.id || '.jpg'),
    foto_original = exists (select 1 from storage.objects o where o.bucket_id = 'originales' and split_part(o.name, '.', 1) = d.id)
  where d.id = p_denuncia and d.autor = auth.uid();
  perform set_config('cde.rpc', '0', true);
end $$;
revoke execute on function public.confirmar_foto(text) from public, anon;
grant execute on function public.confirmar_foto(text) to authenticated;

-- ---------- Limpieza de resueltas ----------
-- Las denuncias resueltas hace más de 2 semanas se borran solas, con sus votos y sus fotos.
-- Se conservan las que tienen una obra municipal (para poder auditar el gasto) y los datos de ejemplo.
create or replace function public.denuncia_existe(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.denuncias where id = p_id);
$$;
grant execute on function public.denuncia_existe(text) to anon, authenticated;

create or replace function public.limpiar_resueltas(p_clave text)
returns table (bucket text, nombre text)
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  delete from public.denuncias d
   where d.estado = 'resuelta' and d.resuelta_en < now() - interval '14 days' and not d.demo
     and not exists (select 1 from public.obras o where o.denuncia = d.id);
  get diagnostics n = row_count;
  if n > 0 then
    perform public.registrar('Limpieza automática', n || ' denuncia' || case when n = 1 then '' else 's' end
      || ' resuelta' || case when n = 1 then '' else 's' end || ' hace más de 2 semanas', false, now(), 'Sistema');
  end if;
  -- Fotos que quedaron sin denuncia: las borra la función de Vercel por la API de Storage.
  return query
    select o.bucket_id::text, o.name::text from storage.objects o
     where o.bucket_id in ('fotos', 'originales') and not public.denuncia_existe(split_part(o.name, '.', 1))
     limit 500;
end $$;
revoke execute on function public.limpiar_resueltas(text) from public;
grant execute on function public.limpiar_resueltas(text) to anon, authenticated;

-- Solo se puede borrar una foto cuya denuncia ya no existe.
drop policy if exists "cde borrar fotos huerfanas" on storage.objects;
create policy "cde borrar fotos huerfanas" on storage.objects for delete to anon, authenticated
  using (bucket_id in ('fotos','originales') and not public.denuncia_existe(split_part(name, '.', 1)));
drop policy if exists "cde ver fotos huerfanas" on storage.objects;
create policy "cde ver fotos huerfanas" on storage.objects for select to anon, authenticated
  using (bucket_id in ('fotos','originales') and not public.denuncia_existe(split_part(name, '.', 1)));

-- ---------- Obras y precios: historial automático ----------
create or replace function public.gs(n numeric) returns text
language sql immutable as $$ select 'Gs. ' || replace(to_char(round(n), 'FM999,999,999,999'), ',', '.') $$;

create or replace function public.obras_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare cambios text[] := '{}';
begin
  new.actualizada := now();
  if not public.desde_la_app() then return new; end if;
  if tg_op = 'INSERT' then
    perform public.registrar('Obra asignada a ' || new.denuncia, new.contratista || ' · ' || public.gs(new.monto));
  else
    if new.monto is distinct from old.monto then cambios := cambios || ('Monto: ' || public.gs(old.monto) || ' → ' || public.gs(new.monto)); end if;
    if new.contratista is distinct from old.contratista then cambios := cambios || ('Contratista: ' || coalesce(old.contratista,'—') || ' → ' || new.contratista); end if;
    if new.fecha is distinct from old.fecha then cambios := cambios || ('Fecha: ' || coalesce(old.fecha::text,'—') || ' → ' || coalesce(new.fecha::text,'—')); end if;
    if new.estado is distinct from old.estado then cambios := cambios || ('Estado: ' || old.estado || ' → ' || new.estado); end if;
    if new.responsable is distinct from old.responsable then cambios := cambios || ('Responsable: ' || coalesce(old.responsable,'—') || ' → ' || coalesce(new.responsable,'—')); end if;
    if array_length(cambios, 1) > 0 then
      perform public.registrar('Obra ' || new.denuncia || ' modificada', array_to_string(cambios, ' · '));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists obras_auditar on public.obras;
create trigger obras_auditar before insert or update on public.obras
  for each row execute function public.obras_auditar();

create or replace function public.parametros_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.desde_la_app() and new.valor is distinct from old.valor then
    perform public.registrar('Precio de referencia', new.nombre || ': ' || old.valor || ' → ' || new.valor);
  end if;
  new.clave := old.clave; new.nombre := old.nombre;
  return new;
end $$;
drop trigger if exists parametros_auditar on public.parametros;
create trigger parametros_auditar before update on public.parametros
  for each row execute function public.parametros_auditar();

-- ---------- Seguridad por filas (RLS) ----------
alter table public.perfiles   enable row level security;
alter table public.denuncias  enable row level security;
alter table public.votos      enable row level security;
alter table public.obras      enable row level security;
alter table public.parametros enable row level security;
alter table public.historial  enable row level security;

drop policy if exists "perfil propio o staff" on public.perfiles;
create policy "perfil propio o staff" on public.perfiles for select
  using (id = auth.uid() or public.es_staff());

-- Las denuncias marcadas como falsas desaparecen para el público; la moderación las sigue viendo.
drop policy if exists "ver denuncias" on public.denuncias;
create policy "ver denuncias" on public.denuncias for select
  using (moderacion is distinct from 'falsa' or (select public.es_staff()));
drop policy if exists "crear denuncias" on public.denuncias;
create policy "crear denuncias" on public.denuncias for insert to authenticated
  with check (auth.uid() is not null);
drop policy if exists "moderar denuncias" on public.denuncias;
create policy "moderar denuncias" on public.denuncias for update to authenticated
  using (public.es_staff()) with check (public.es_staff());
-- Nadie borra denuncias desde la app (no hay política de DELETE).

drop policy if exists "mis votos" on public.votos;
create policy "mis votos" on public.votos for select to authenticated using (usuario = auth.uid());

drop policy if exists "ver obras" on public.obras;
create policy "ver obras" on public.obras for select using (true);
drop policy if exists "cargar obras" on public.obras;
create policy "cargar obras" on public.obras for insert to authenticated with check (public.es_municipal());
drop policy if exists "editar obras" on public.obras;
create policy "editar obras" on public.obras for update to authenticated using (public.es_municipal()) with check (public.es_municipal());

drop policy if exists "ver precios" on public.parametros;
create policy "ver precios" on public.parametros for select using (true);
drop policy if exists "editar precios" on public.parametros;
create policy "editar precios" on public.parametros for update to authenticated using (public.es_municipal()) with check (public.es_municipal());

drop policy if exists "ver historial" on public.historial;
create policy "ver historial" on public.historial for select using (true);
-- El historial solo lo escriben las funciones de arriba; no hay INSERT, UPDATE ni DELETE para la app.

-- ---------- Fotos ----------
-- "fotos": copia liviana (WebP) pública, la ve cualquiera en el mapa.
-- "originales": archivo original intacto, privado; solo lo abre la moderación con un enlace temporal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('fotos', 'fotos', true, 409600, array['image/webp','image/jpeg']),
  ('originales', 'originales', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif','image/gif'])
on conflict (id) do nothing;

-- Cada archivo se llama como la denuncia (D-XXXXXX.webp) y solo lo puede subir quien la creó, una sola vez.
drop policy if exists "cde subir foto" on storage.objects;
create policy "cde subir foto" on storage.objects for insert to authenticated
  with check (bucket_id in ('fotos','originales')
    and exists (select 1 from public.denuncias d where d.id = split_part(name, '.', 1) and d.autor = auth.uid()));
drop policy if exists "cde ver originales" on storage.objects;
create policy "cde ver originales" on storage.objects for select to authenticated
  using (bucket_id = 'originales' and public.es_staff());

-- ---------- Tiempo real ----------
do $$
declare t text;
begin
  foreach t in array array['denuncias','obras','historial','parametros'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

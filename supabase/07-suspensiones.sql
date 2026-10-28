-- Mapa Ciudadano CDE · Suspensión de usuarios por la moderación.
-- Ejecutalo una vez en Supabase > SQL Editor (se puede repetir sin problema), después de 06-limpiar-resueltas.sql.
-- Un usuario suspendido no puede hacer denuncias ni votar. Lo bloquea la base de datos, no solo la página.
-- El usuario puede apelar una vez cada suspensión; la moderación acepta (se levanta y vuelven sus denuncias) o rechaza.

-- ---------- Suspensiones ----------
create table if not exists public.suspensiones (
  usuario     uuid primary key references public.perfiles(id) on delete cascade,
  hasta       timestamptz,                    -- null = permanente
  motivo      text not null check (char_length(motivo) between 3 and 300),
  por         uuid,                           -- moderador que suspendió
  por_nombre  text,
  denuncia    text,                           -- denuncia desde la que se suspendió (referencia)
  creada      timestamptz not null default now()
);
-- Denuncias que se ocultaron con la suspensión: si se acepta la apelación, vuelven al mapa.
alter table public.suspensiones add column if not exists ocultadas text[] not null default '{}';
alter table public.suspensiones enable row level security;
-- Cada uno ve su propia suspensión; la moderación ve todas. Solo se escriben con las funciones de abajo.
drop policy if exists "ver suspensiones" on public.suspensiones;
create policy "ver suspensiones" on public.suspensiones for select
  using (usuario = auth.uid() or public.es_staff());

create or replace function public.esta_suspendido(p_usuario uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.suspensiones where usuario = p_usuario and (hasta is null or hasta > now()))
$$;

-- Nombre corto para el historial: el nombre del perfil o el comienzo del identificador.
create or replace function public.nombre_usuario(p_usuario uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select nombre from public.perfiles where id = p_usuario), ''), 'usuario ' || left(p_usuario::text, 8))
$$;

-- ---------- Bloqueos ----------
create or replace function public.bloquear_suspendidos() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not public.desde_la_app() or auth.uid() is null then return new; end if;
  select hasta, motivo into s from public.suspensiones where usuario = auth.uid() and (hasta is null or hasta > now());
  if found then
    raise exception 'Tu cuenta está suspendida %. Motivo: %',
      case when s.hasta is null then 'de forma permanente' else 'hasta el ' || to_char(s.hasta at time zone 'America/Asuncion', 'DD/MM/YYYY HH24:MI') end,
      s.motivo using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists denuncias_bloquear_suspendidos on public.denuncias;
create trigger denuncias_bloquear_suspendidos before insert on public.denuncias
  for each row execute function public.bloquear_suspendidos();
drop trigger if exists votos_bloquear_suspendidos on public.votos;
create trigger votos_bloquear_suspendidos before insert on public.votos
  for each row execute function public.bloquear_suspendidos();

-- ---------- Suspender (uso interno) ----------
-- La usan la moderación (suspender_usuario) y la revisión automática con IA (08-antispam.sql).
-- p_dias: 1 a 365, o null (permanente). p_ocultar: además marca como falsas todas sus denuncias (para spam).
-- Devuelve cuántas denuncias se ocultaron.
create or replace function public.aplicar_suspension(p_usuario uuid, p_dias int, p_motivo text, p_ocultar boolean,
  p_denuncia text, p_por uuid, p_por_nombre text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_hasta timestamptz; v_ids text[] := '{}';
begin
  if p_dias is not null and p_dias not between 1 and 365 then raise exception 'Plazo inválido.'; end if;
  if char_length(coalesce(trim(p_motivo), '')) < 3 then raise exception 'Escribí el motivo de la suspensión.'; end if;
  v_hasta := case when p_dias is null then null else now() + make_interval(days => p_dias) end;

  insert into public.suspensiones (usuario, hasta, motivo, por, por_nombre, denuncia, creada)
  values (p_usuario, v_hasta, left(trim(p_motivo), 300), p_por, p_por_nombre, p_denuncia, now())
  on conflict (usuario) do update set hasta = excluded.hasta, motivo = excluded.motivo, por = excluded.por,
    por_nombre = excluded.por_nombre, denuncia = excluded.denuncia, creada = excluded.creada,
    -- Si la suspensión anterior ya había vencido, se empieza de cero.
    ocultadas = case when suspensiones.hasta is not null and suspensiones.hasta <= now() then '{}' else suspensiones.ocultadas end;

  if p_ocultar then
    perform set_config('cde.rpc', '1', true);
    with u as (
      update public.denuncias set moderacion = 'falsa'
       where autor = p_usuario and not demo and moderacion is distinct from 'falsa'
      returning id)
    select coalesce(array_agg(id), '{}') into v_ids from u;
    perform set_config('cde.rpc', '0', true);
    update public.suspensiones set ocultadas = ocultadas || v_ids where usuario = p_usuario;
  end if;

  perform public.registrar('Suspensión de ' || public.nombre_usuario(p_usuario),
    case when p_dias is null then 'Permanente' else p_dias || ' días' end || ' · Motivo: ' || trim(p_motivo)
    || coalesce(' · Desde la denuncia ' || p_denuncia, '')
    || case when cardinality(v_ids) > 0 then ' · ' || cardinality(v_ids) || ' denuncia' || case when cardinality(v_ids) = 1 then '' else 's' end
         || ' ocultada' || case when cardinality(v_ids) = 1 then '' else 's' end else '' end,
    false, now(), p_por_nombre);
  return cardinality(v_ids);
end $$;
revoke execute on function public.aplicar_suspension(uuid, int, text, boolean, text, uuid, text) from public, anon, authenticated;

-- ---------- Funciones para la moderación ----------
create or replace function public.suspender_usuario(p_usuario uuid, p_dias int, p_motivo text, p_ocultar boolean default false, p_denuncia text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_rol text;
begin
  if not public.es_staff() then raise exception 'Solo la moderación puede suspender usuarios.' using errcode = '42501'; end if;
  if p_usuario is null then raise exception 'Falta el usuario.'; end if;
  if p_usuario = auth.uid() then raise exception 'No podés suspender tu propia cuenta.' using errcode = '42501'; end if;
  select rol into v_rol from public.perfiles where id = p_usuario;
  if not found then raise exception 'Ese usuario no existe.'; end if;
  if v_rol <> 'vecino' and public.mi_rol() <> 'admin' then
    raise exception 'Solo la administración puede suspender a moderadores o a la municipalidad.' using errcode = '42501';
  end if;
  return public.aplicar_suspension(p_usuario, p_dias, p_motivo, coalesce(p_ocultar, false), p_denuncia, auth.uid(), public.quien_soy());
end $$;
revoke execute on function public.suspender_usuario(uuid, int, text, boolean, text) from public, anon;
grant execute on function public.suspender_usuario(uuid, int, text, boolean, text) to authenticated;

-- ---------- Apelaciones ----------
create table if not exists public.apelaciones (
  id           bigint generated always as identity primary key,
  usuario      uuid not null references public.perfiles(id) on delete cascade,
  texto        text not null check (char_length(texto) between 10 and 600),
  estado       text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada')),
  respuesta    text,
  revisada_por text,
  creada       timestamptz not null default now(),
  revisada     timestamptz
);
create index if not exists apelaciones_usuario_idx on public.apelaciones (usuario, creada desc);
alter table public.apelaciones enable row level security;
drop policy if exists "ver apelaciones" on public.apelaciones;
create policy "ver apelaciones" on public.apelaciones for select
  using (usuario = auth.uid() or public.es_staff());

-- La apelación de la suspensión vigente (la última hecha después de que empezó).
create or replace function public.apelacion_vigente(p_usuario uuid) returns public.apelaciones
language sql stable security definer set search_path = public as $$
  select a.* from public.apelaciones a join public.suspensiones s on s.usuario = a.usuario
   where a.usuario = p_usuario and a.creada >= s.creada
   order by a.creada desc limit 1
$$;
revoke execute on function public.apelacion_vigente(uuid) from public, anon, authenticated;

-- El usuario suspendido explica por qué cree que es un error. Una apelación por suspensión.
create or replace function public.apelar_suspension(p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que ingresar para apelar.' using errcode = '42501'; end if;
  if not public.esta_suspendido() then raise exception 'Tu cuenta no está suspendida.'; end if;
  if (public.apelacion_vigente(auth.uid())).id is not null then
    raise exception 'Ya apelaste esta suspensión. La moderación te va a responder.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(trim(p_texto), '')) < 10 then raise exception 'Contá en al menos 10 letras por qué creés que es un error.'; end if;
  insert into public.apelaciones (usuario, texto) values (auth.uid(), left(trim(p_texto), 600));
  perform public.registrar('Apelación de ' || public.nombre_usuario(auth.uid()), left(trim(p_texto), 200));
end $$;
revoke execute on function public.apelar_suspension(text) from public, anon;
grant execute on function public.apelar_suspension(text) to authenticated;

-- La moderación responde. Si acepta, se levanta la suspensión y vuelven al mapa las denuncias que se habían ocultado.
create or replace function public.responder_apelacion(p_id bigint, p_aceptar boolean, p_respuesta text default null) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.apelaciones; v_ids text[]; v_n int := 0;
begin
  if not public.es_staff() then raise exception 'Solo la moderación puede responder apelaciones.' using errcode = '42501'; end if;
  select * into a from public.apelaciones where id = p_id for update;
  if not found then raise exception 'Esa apelación no existe.'; end if;
  if a.estado <> 'pendiente' then raise exception 'Esa apelación ya fue respondida.'; end if;
  if a.usuario = auth.uid() then raise exception 'No podés responder tu propia apelación.' using errcode = '42501'; end if;
  update public.apelaciones set estado = case when p_aceptar then 'aceptada' else 'rechazada' end,
         respuesta = nullif(left(trim(coalesce(p_respuesta, '')), 300), ''), revisada_por = public.quien_soy(), revisada = now()
   where id = p_id;
  if p_aceptar then
    delete from public.suspensiones where usuario = a.usuario returning ocultadas into v_ids;
    if cardinality(v_ids) > 0 then
      perform set_config('cde.rpc', '1', true);
      update public.denuncias set moderacion = null where id = any(v_ids) and moderacion = 'falsa';
      get diagnostics v_n = row_count;
      perform set_config('cde.rpc', '0', true);
    end if;
  end if;
  perform public.registrar('Apelación de ' || public.nombre_usuario(a.usuario) || case when p_aceptar then ' aceptada' else ' rechazada' end,
    case when p_aceptar then 'Suspensión levantada' || case when v_n > 0 then ' · ' || v_n || ' denuncia' || case when v_n = 1 then ' vuelve' else 's vuelven' end || ' al mapa' else '' end
         else 'La suspensión sigue' end
    || coalesce(' · ' || nullif(trim(coalesce(p_respuesta, '')), ''), ''));
  return v_n;
end $$;
revoke execute on function public.responder_apelacion(bigint, boolean, text) from public, anon;
grant execute on function public.responder_apelacion(bigint, boolean, text) to authenticated;

create or replace function public.levantar_suspension(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_staff() then raise exception 'Solo la moderación puede levantar suspensiones.' using errcode = '42501'; end if;
  update public.apelaciones set estado = 'aceptada', respuesta = 'Se levantó la suspensión.', revisada_por = public.quien_soy(), revisada = now()
   where usuario = p_usuario and estado = 'pendiente';
  delete from public.suspensiones where usuario = p_usuario;
  if found then perform public.registrar('Suspensión levantada', public.nombre_usuario(p_usuario)); end if;
end $$;
revoke execute on function public.levantar_suspension(uuid) from public, anon;
grant execute on function public.levantar_suspension(uuid) to authenticated;

-- Suspensiones vigentes, con su apelación pendiente si la hay, para el panel de moderación.
drop function if exists public.suspendidos();
create or replace function public.suspendidos()
returns table (usuario uuid, nombre text, hasta timestamptz, motivo text, por_nombre text, denuncia text, creada timestamptz, denuncias int,
               apelacion bigint, apelacion_texto text, apelacion_estado text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_staff() then raise exception 'Solo la moderación puede ver los suspendidos.' using errcode = '42501'; end if;
  return query
    select s.usuario, public.nombre_usuario(s.usuario), s.hasta, s.motivo, s.por_nombre, s.denuncia, s.creada,
           (select count(*)::int from public.denuncias d where d.autor = s.usuario),
           a.id, a.texto, a.estado
      from public.suspensiones s
      left join lateral (select * from public.apelaciones x where x.usuario = s.usuario and x.creada >= s.creada order by x.creada desc limit 1) a on true
     where s.hasta is null or s.hasta > now()
     order by (a.estado = 'pendiente') desc nulls last, s.creada desc;
end $$;
revoke execute on function public.suspendidos() from public, anon;
grant execute on function public.suspendidos() to authenticated;

-- La suspensión vigente de quien llama (vacío si no está suspendido) y cómo va su apelación, para avisarle en la página.
drop function if exists public.mi_suspension();
create or replace function public.mi_suspension()
returns table (hasta timestamptz, motivo text, por_nombre text, apelacion_estado text, apelacion_respuesta text)
language sql stable security definer set search_path = public as $$
  select s.hasta, s.motivo, s.por_nombre, a.estado, a.respuesta
    from public.suspensiones s
    left join lateral (select * from public.apelaciones x where x.usuario = s.usuario and x.creada >= s.creada order by x.creada desc limit 1) a on true
   where s.usuario = auth.uid() and (s.hasta is null or s.hasta > now())
$$;
grant execute on function public.mi_suspension() to anon, authenticated;

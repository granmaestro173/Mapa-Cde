-- Mapa Ciudadano CDE · Suspensión de usuarios por la moderación.
-- Ejecutalo una vez en Supabase > SQL Editor (se puede repetir sin problema), después de 06-limpiar-resueltas.sql.
-- Un usuario suspendido no puede hacer denuncias ni votar. Lo bloquea la base de datos, no solo la página.

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

-- ---------- Funciones para la moderación ----------
-- p_dias: 7, 30 o null (permanente). p_ocultar: además marca como falsas todas sus denuncias (para spam).
-- Devuelve cuántas denuncias se ocultaron.
create or replace function public.suspender_usuario(p_usuario uuid, p_dias int, p_motivo text, p_ocultar boolean default false, p_denuncia text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_rol text; v_hasta timestamptz; v_n int := 0;
begin
  if not public.es_staff() then raise exception 'Solo la moderación puede suspender usuarios.' using errcode = '42501'; end if;
  if p_usuario is null then raise exception 'Falta el usuario.'; end if;
  if p_usuario = auth.uid() then raise exception 'No podés suspender tu propia cuenta.' using errcode = '42501'; end if;
  select rol into v_rol from public.perfiles where id = p_usuario;
  if not found then raise exception 'Ese usuario no existe.'; end if;
  if v_rol <> 'vecino' and public.mi_rol() <> 'admin' then
    raise exception 'Solo la administración puede suspender a moderadores o a la municipalidad.' using errcode = '42501';
  end if;
  if p_dias is not null and p_dias not between 1 and 365 then raise exception 'Plazo inválido.'; end if;
  if char_length(coalesce(trim(p_motivo), '')) < 3 then raise exception 'Escribí el motivo de la suspensión.'; end if;
  v_hasta := case when p_dias is null then null else now() + make_interval(days => p_dias) end;

  insert into public.suspensiones (usuario, hasta, motivo, por, por_nombre, denuncia, creada)
  values (p_usuario, v_hasta, trim(p_motivo), auth.uid(), public.quien_soy(), p_denuncia, now())
  on conflict (usuario) do update set hasta = excluded.hasta, motivo = excluded.motivo, por = excluded.por,
    por_nombre = excluded.por_nombre, denuncia = excluded.denuncia, creada = excluded.creada;

  if p_ocultar then
    perform set_config('cde.rpc', '1', true);
    update public.denuncias set moderacion = 'falsa'
     where autor = p_usuario and not demo and moderacion is distinct from 'falsa';
    get diagnostics v_n = row_count;
    perform set_config('cde.rpc', '0', true);
  end if;

  perform public.registrar('Suspensión de ' || public.nombre_usuario(p_usuario),
    case when p_dias is null then 'Permanente' else p_dias || ' días' end || ' · Motivo: ' || trim(p_motivo)
    || coalesce(' · Desde la denuncia ' || p_denuncia, '')
    || case when v_n > 0 then ' · ' || v_n || ' denuncia' || case when v_n = 1 then '' else 's' end || ' ocultada' || case when v_n = 1 then '' else 's' end else '' end);
  return v_n;
end $$;
revoke execute on function public.suspender_usuario(uuid, int, text, boolean, text) from public, anon;
grant execute on function public.suspender_usuario(uuid, int, text, boolean, text) to authenticated;

create or replace function public.levantar_suspension(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_staff() then raise exception 'Solo la moderación puede levantar suspensiones.' using errcode = '42501'; end if;
  delete from public.suspensiones where usuario = p_usuario;
  if found then perform public.registrar('Suspensión levantada', public.nombre_usuario(p_usuario)); end if;
end $$;
revoke execute on function public.levantar_suspension(uuid) from public, anon;
grant execute on function public.levantar_suspension(uuid) to authenticated;

-- Suspensiones vigentes, para el panel de moderación.
create or replace function public.suspendidos()
returns table (usuario uuid, nombre text, hasta timestamptz, motivo text, por_nombre text, denuncia text, creada timestamptz, denuncias int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_staff() then raise exception 'Solo la moderación puede ver los suspendidos.' using errcode = '42501'; end if;
  return query
    select s.usuario, public.nombre_usuario(s.usuario), s.hasta, s.motivo, s.por_nombre, s.denuncia, s.creada,
           (select count(*)::int from public.denuncias d where d.autor = s.usuario)
      from public.suspensiones s
     where s.hasta is null or s.hasta > now()
     order by s.creada desc;
end $$;
revoke execute on function public.suspendidos() from public, anon;
grant execute on function public.suspendidos() to authenticated;

-- La suspensión vigente de quien llama (vacío si no está suspendido), para avisarle en la página.
create or replace function public.mi_suspension() returns table (hasta timestamptz, motivo text)
language sql stable security definer set search_path = public as $$
  select s.hasta, s.motivo from public.suspensiones s
   where s.usuario = auth.uid() and (s.hasta is null or s.hasta > now())
$$;
grant execute on function public.mi_suspension() to anon, authenticated;

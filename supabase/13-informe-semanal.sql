-- Mapa Ciudadano CDE · Reporte de esta semana, escrito por la IA cada lunes.
-- Ejecutalo una vez en Supabase > SQL Editor (se puede repetir sin problema). Necesita 05-verificacion-ia.sql.
-- Cada lunes a las 7:00 (hora de Paraguay) Supabase le pide a la función de Vercel /api/semanal que lo escriba
-- con los números de los últimos 7 días; el reporte queda guardado y todos lo ven al fondo del panel "Explorar".
-- Si tu página no es https://mapa-cde-zspd.vercel.app, cambiá la dirección de la parte 2.

-- ===== Parte 1: tabla y funciones =====
create table if not exists public.informes (
  semana  date primary key,                      -- lunes de la semana del reporte
  creado  timestamptz not null default now(),
  desde   timestamptz not null,
  hasta   timestamptz not null,
  texto   text not null check (char_length(texto) <= 3000),
  datos   jsonb not null default '{}'::jsonb
);
alter table public.informes enable row level security;
drop policy if exists "ver informes" on public.informes;
create policy "ver informes" on public.informes for select using (true);
grant select on public.informes to anon, authenticated;

-- Números de los últimos 7 días (y de los 7 anteriores, para comparar). Solo con la clave de la IA.
create or replace function public.informe_datos(p_clave text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hasta timestamptz := now();
  desde timestamptz := now() - interval '7 days';
  r jsonb;
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  with d as (select * from public.denuncias where coalesce(moderacion, '') <> 'falsa'),
  sem as (select * from d where creada >= desde)
  select jsonb_build_object(
    'desde', desde, 'hasta', hasta,
    'denuncias_nuevas', (select count(*) from sem),
    'denuncias_semana_anterior', (select count(*) from d where creada >= desde - interval '7 days' and creada < desde),
    'resueltas_en_la_semana', (select count(*) from d where resuelta_en >= desde),
    'nuevas_ya_en_proceso', (select count(*) from sem where estado = 'en_proceso'),
    'sin_resolver_en_total', (select count(*) from d where estado <> 'resuelta'),
    'verificadas_por_la_municipalidad', (select count(*) from sem where moderacion = 'verificada'),
    'confirmaciones_de_vecinos', (select coalesce(sum(votos), 0) from sem),
    'por_categoria', (select coalesce(jsonb_object_agg(categoria, n), '{}'::jsonb)
                        from (select categoria, count(*) n from sem group by categoria order by 2 desc) x),
    'barrios_mas_afectados', (select coalesce(jsonb_agg(x order by x.denuncias desc), '[]'::jsonb) from (
        select barrio, count(*) denuncias, count(*) filter (where estado <> 'resuelta') sin_resolver,
               round(avg(gravedad), 1) gravedad_media,
               (select s2.categoria from sem s2 where s2.barrio = sem.barrio group by s2.categoria order by count(*) desc limit 1) problema_principal
          from sem where barrio is not null group by barrio order by count(*) desc limit 5) x),
    'dias_promedio_para_resolver', (select round(extract(epoch from avg(resuelta_en - creada)) / 86400, 1) from d where resuelta_en >= desde)
  ) into r;
  return r;
end $$;
revoke execute on function public.informe_datos(text) from public;
grant execute on function public.informe_datos(text) to anon, authenticated;

create or replace function public.informe_guardar(p_clave text, p_texto text, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare lunes date := date_trunc('week', now() at time zone 'America/Asuncion')::date;
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  insert into public.informes (semana, desde, hasta, texto, datos)
  values (lunes, (p_datos->>'desde')::timestamptz, (p_datos->>'hasta')::timestamptz, left(p_texto, 3000), p_datos)
  on conflict (semana) do update set creado = now(), desde = excluded.desde, hasta = excluded.hasta, texto = excluded.texto, datos = excluded.datos;
  -- Se guardan los últimos 12 reportes.
  delete from public.informes where semana < lunes - 84;
end $$;
revoke execute on function public.informe_guardar(text, text, jsonb) from public;
grant execute on function public.informe_guardar(text, text, jsonb) to anon, authenticated;

-- ===== Parte 2: cada lunes a las 7:00 de Paraguay (10:00 UTC) =====
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule('informe-semanal', '0 10 * * 1', $cron$
  select net.http_post(
    url := 'https://mapa-cde-zspd.vercel.app/api/semanal',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-clave', (select valor from privado.ajustes where clave = 'ia_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$cron$);

-- ===== Parte 3: el primer reporte, ahora mismo =====
-- Así no hay que esperar al lunes. Tarda unos segundos en aparecer en la página.
select net.http_post(
  url := 'https://mapa-cde-zspd.vercel.app/api/semanal',
  headers := jsonb_build_object('content-type', 'application/json',
                                'x-clave', (select valor from privado.ajustes where clave = 'ia_clave')),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000);

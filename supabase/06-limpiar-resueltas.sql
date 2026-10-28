-- Mapa Ciudadano CDE · Limpieza automática de denuncias resueltas.
-- Ejecutalo una vez en Supabase > SQL Editor (se puede repetir sin problema), después de 05-verificacion-ia.sql.
-- Todos los días a las 4 de la mañana se borran las denuncias resueltas hace más de 2 semanas, con sus votos y fotos.
-- Si tu página no es https://mapa-cde-zspd.vercel.app, cambiá la dirección de la parte 2.

-- ===== Parte 1: funciones y permisos =====
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

-- ===== Parte 2: limpieza diaria (07:15 UTC = 4:15 en Paraguay) =====
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule('limpiar-resueltas', '15 7 * * *', $cron$
  select net.http_post(
    url := 'https://mapa-cde-zspd.vercel.app/api/limpiar',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-clave', (select valor from privado.ajustes where clave = 'ia_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$cron$);

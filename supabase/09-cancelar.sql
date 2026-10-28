-- Mapa Ciudadano CDE · 3 minutos para cancelar una denuncia recién publicada.
-- Ejecutalo una vez en Supabase > SQL Editor (se puede repetir sin problema), después de 08-antispam.sql.
--
-- La denuncia se publica y la ven todos enseguida. Durante los primeros 3 minutos quien la hizo puede cancelarla si se
-- equivocó (se borra con sus fotos). Pasado ese tiempo ya no se puede cancelar.
-- La IA no la revisa hasta que termina ese tiempo, para no gastar en denuncias que se cancelan.

-- Cancelar: solo quien la hizo y solo dentro de los 3 minutos (con unos segundos de margen por la conexión).
-- Las fotos quedan sin denuncia y la página las borra (la regla "cde borrar fotos huerfanas" lo permite).
create or replace function public.cancelar_denuncia(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_autor uuid; v_creada timestamptz;
begin
  select autor, creada into v_autor, v_creada from public.denuncias where id = p_id;
  if v_autor is null or v_autor <> auth.uid() then
    raise exception 'Solo quien hizo la denuncia puede cancelarla.' using errcode = '42501';
  end if;
  if v_creada < now() - interval '3 minutes 15 seconds' then
    raise exception 'Pasaron los 3 minutos: la denuncia ya no se puede cancelar.' using errcode = 'P0001';
  end if;
  delete from public.denuncias where id = p_id;
  return true;
end $$;
revoke execute on function public.cancelar_denuncia(text) from public;
grant execute on function public.cancelar_denuncia(text) to authenticated;

-- Denuncias que todavía no revisó la IA, con las señales de la cuenta que las hizo.
-- Las que no tienen foto se revisan solo por el texto (las de los últimos 30 días, para no repasar todo lo viejo).
drop function if exists public.ia_pendientes(text, int);
create or replace function public.ia_pendientes(p_clave text, p_limite int default 8)
returns table (id text, categoria text, descripcion text, barrio text, foto text,
               cuenta_horas int, denuncias_hora int, denuncias_dia int, mismo_texto int, ocultadas_antes int, segundos_desde_anterior int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  return query
    select d.id, d.categoria, d.descripcion, d.barrio,
           case when d.foto then (select o.name from storage.objects o where o.bucket_id = 'fotos' and o.name like d.id || '.%' order by o.name desc limit 1) end,
           (select (extract(epoch from d.creada - p.creado) / 3600)::int from public.perfiles p where p.id = d.autor),
           (select count(*)::int from public.denuncias x where x.autor = d.autor and x.creada between d.creada - interval '1 hour' and d.creada),
           (select count(*)::int from public.denuncias x where x.autor = d.autor and x.creada between d.creada - interval '1 day' and d.creada),
           (select count(*)::int from public.denuncias x where x.autor = d.autor and x.id <> d.id and x.creada > d.creada - interval '7 days'
               and lower(trim(x.descripcion)) = lower(trim(d.descripcion))),
           (select count(*)::int from public.denuncias x where x.autor = d.autor and x.id <> d.id and x.moderacion = 'falsa'
               and x.creada > d.creada - interval '30 days'),
           (select (extract(epoch from d.creada - max(x.creada)))::int from public.denuncias x where x.autor = d.autor and x.creada < d.creada)
      from public.denuncias d
     where d.ia_revisada is null and not d.demo and coalesce(d.moderacion, '') <> 'falsa'
       and d.creada < now() - interval '3 minutes'
       and (d.foto or d.creada > now() - interval '30 days')
     order by d.creada
     limit least(greatest(coalesce(p_limite, 8), 1), 20);
end $$;
revoke execute on function public.ia_pendientes(text, int) from public;
grant execute on function public.ia_pendientes(text, int) to anon, authenticated;

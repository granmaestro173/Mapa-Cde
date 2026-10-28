-- Mapa Ciudadano CDE · Verificación automática con IA cada 5 minutos.
-- Ejecutalo una vez en Supabase > SQL Editor (se puede repetir sin problema).
-- Antes, cargá en Vercel ANTHROPIC_API_KEY, SUPABASE_URL y SUPABASE_ANON_KEY (README, paso 4).
-- Si tu página no es https://mapa-cde-zspd.vercel.app, cambiá la dirección de la parte 2.

-- ===== Parte 1: columnas y funciones =====
-- ---------- Verificación automática con IA ----------
-- Cada denuncia nueva con foto la revisa Claude una vez: si la foto coincide con lo denunciado queda "verificada";
-- si no, "dudosa" (eso solo lo ve la moderación). Las denuncias sin foto no se escanean.
alter table public.denuncias add column if not exists ia_estado text check (ia_estado in ('verificada','dudosa','sin_foto','error'));
alter table public.denuncias add column if not exists ia_motivo text;
alter table public.denuncias add column if not exists ia_resumen text;   -- lo que la IA ve en la foto, en una frase corta
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
    new.ia_estado := null; new.ia_motivo := null; new.ia_resumen := null; new.ia_revisada := null;
  else
    new.ia_estado := old.ia_estado; new.ia_motivo := old.ia_motivo; new.ia_resumen := old.ia_resumen; new.ia_revisada := old.ia_revisada;
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

drop function if exists public.ia_guardar(text, text, text, text);
create or replace function public.ia_guardar(p_clave text, p_id text, p_estado text, p_motivo text, p_resumen text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  if p_estado not in ('verificada','dudosa','sin_foto','error') then raise exception 'Resultado inválido.'; end if;
  perform set_config('cde.rpc', '1', true);
  update public.denuncias
     set ia_estado = p_estado, ia_motivo = left(p_motivo, 300), ia_resumen = left(p_resumen, 140), ia_revisada = now()
   where id = p_id;
  perform set_config('cde.rpc', '0', true);
end $$;
revoke execute on function public.ia_guardar(text, text, text, text, text) from public;
grant execute on function public.ia_guardar(text, text, text, text, text) to anon, authenticated;

-- ===== Parte 2: revisión programada cada 5 minutos =====
-- Supabase llama a la función de Vercel solo si hay denuncias sin revisar, así no gasta de más.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule('verificar-con-ia', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://mapa-cde-zspd.vercel.app/api/verificar',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-clave', (select valor from privado.ajustes where clave = 'ia_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.denuncias
                 where ia_revisada is null and not demo and coalesce(moderacion, '') <> 'falsa'
                   and foto);
$cron$);

-- ===== Parte 3: tu clave =====
-- Copiá el valor que aparece abajo y cargalo en Vercel como IA_CLAVE (Settings > Environment Variables).
select valor as copiar_en_vercel_como_IA_CLAVE from privado.ajustes where clave = 'ia_clave';

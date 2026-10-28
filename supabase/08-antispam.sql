-- Mapa Ciudadano CDE · La IA (Claude Haiku) detecta spam, bots y contenido ofensivo, y actúa.
-- Ejecutalo una vez en Supabase > SQL Editor (se puede repetir sin problema), después de 05-verificacion-ia.sql y 07-suspensiones.sql.
--
-- Cada denuncia nueva (con o sin foto) la revisa la IA una vez. Además del texto y la foto, recibe señales de la cuenta
-- (cuántas denuncias hizo en la última hora y el último día, si repite el mismo texto, cuánto hace que existe la cuenta).
-- Qué hace con lo que encuentra:
--   - Confianza alta: oculta la denuncia (la marca como falsa). La moderación puede quitar la marca si se equivocó.
--   - Confianza media: la deja en el mapa pero la manda a la cola de moderación como "IA: posible spam".
--   - Bot con confianza alta: suspende la cuenta 30 días y oculta sus denuncias.
--   - Tres denuncias ocultadas por la IA en 7 días: suspende la cuenta 7 días.
-- Las suspensiones automáticas solo se aplican a vecinos (nunca a la moderación ni a la municipalidad) y se pueden apelar:
-- si la moderación acepta la apelación, vuelven al mapa todas las denuncias que se ocultaron.

alter table public.denuncias add column if not exists ia_abuso text check (ia_abuso in ('spam','bot','ofensivo'));
create index if not exists denuncias_ia_abuso_idx on public.denuncias (autor, creada) where ia_abuso is not null;

-- Nadie puede escribir el resultado de la IA desde la página: solo la función ia_guardar.
create or replace function public.denuncias_proteger_ia() returns trigger
language plpgsql as $$
begin
  if not public.desde_la_app() or current_setting('cde.rpc', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.ia_estado := null; new.ia_motivo := null; new.ia_resumen := null; new.ia_revisada := null; new.ia_abuso := null;
  else
    new.ia_estado := old.ia_estado; new.ia_motivo := old.ia_motivo; new.ia_resumen := old.ia_resumen; new.ia_revisada := old.ia_revisada;
    new.ia_abuso := old.ia_abuso;
  end if;
  return new;
end $$;

-- Lo que oculta la IA queda en el historial a nombre de la IA (ia_guardar), no repetido como "Sistema".
create or replace function public.denuncias_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare lbl jsonb := '{"recibida":"Recibida","en_proceso":"En proceso","resuelta":"Resuelta"}';
begin
  if not public.desde_la_app() or current_setting('cde.ia', true) = '1' then return new; end if;
  if new.moderacion is distinct from old.moderacion then
    perform public.registrar('Moderación de ' || new.id,
      case new.moderacion when 'verificada' then 'Verificada' when 'falsa' then 'Marcada como falsa' else 'Marca quitada' end);
  end if;
  if new.estado is distinct from old.estado then
    perform public.registrar('Estado de ' || new.id, (lbl->>old.estado) || ' → ' || (lbl->>new.estado));
  end if;
  return new;
end $$;

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
       and (d.foto or d.creada > now() - interval '30 days')
     order by d.creada
     limit least(greatest(coalesce(p_limite, 8), 1), 20);
end $$;
revoke execute on function public.ia_pendientes(text, int) from public;
grant execute on function public.ia_pendientes(text, int) to anon, authenticated;

-- Guarda el resultado de la IA y aplica las acciones contra el spam. Devuelve lo que hizo:
-- 'nada', 'cola' (a moderación), 'oculta' u 'oculta_y_suspendida'.
drop function if exists public.ia_guardar(text, text, text, text);
drop function if exists public.ia_guardar(text, text, text, text, text);
create or replace function public.ia_guardar(p_clave text, p_id text, p_estado text, p_motivo text, p_resumen text default null,
  p_abuso text default null, p_abuso_confianza text default null, p_abuso_motivo text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_abuso text := case when p_abuso in ('spam','bot','ofensivo') and p_abuso_confianza in ('alta','media') then p_abuso end;
  v_alta boolean := p_abuso_confianza = 'alta';
  v_autor uuid; v_rol text; v_n int; v_accion text := 'nada';
  v_nombre constant text := 'IA (Claude Haiku)';
  v_que constant jsonb := '{"spam":"spam","bot":"actividad de bot","ofensivo":"contenido ofensivo"}';
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  if p_estado not in ('verificada','dudosa','sin_foto','error') then raise exception 'Resultado inválido.'; end if;
  perform set_config('cde.rpc', '1', true);
  perform set_config('cde.ia', '1', true);
  update public.denuncias
     set ia_estado = case when v_abuso is not null then 'dudosa' else p_estado end,
         ia_motivo = left(case when v_abuso is not null then coalesce(nullif(p_abuso_motivo, ''), p_motivo) else p_motivo end, 300),
         ia_resumen = left(p_resumen, 140), ia_revisada = now(), ia_abuso = v_abuso,
         moderacion = case when v_abuso is not null and v_alta and moderacion is null then 'falsa' else moderacion end
   where id = p_id
  returning autor into v_autor;

  if v_abuso is not null then
    v_accion := case when v_alta then 'oculta' else 'cola' end;
    if v_alta then
      perform public.registrar('Moderación de ' || p_id, 'Ocultada por ' || (v_que->>v_abuso) || ' · ' || left(coalesce(nullif(p_abuso_motivo, ''), p_motivo, ''), 200),
        false, now(), v_nombre);
      -- Suspensión automática: solo vecinos que no estén ya suspendidos.
      select rol into v_rol from public.perfiles where id = v_autor;
      if v_autor is not null and coalesce(v_rol, 'vecino') = 'vecino' and not public.esta_suspendido(v_autor) then
        select count(*) into v_n from public.denuncias
         where autor = v_autor and ia_abuso is not null and moderacion = 'falsa' and creada > now() - interval '7 days';
        if v_abuso = 'bot' then
          perform public.aplicar_suspension(v_autor, 30, 'La revisión automática detectó actividad de bot (denuncias automáticas o en masa). Si es un error, apelá.',
            true, p_id, null, v_nombre);
          v_accion := 'oculta_y_suspendida';
        elsif v_n >= 3 then
          perform public.aplicar_suspension(v_autor, 7, 'La revisión automática ocultó ' || v_n || ' denuncias tuyas por ' || (v_que->>v_abuso) || ' en una semana. Si es un error, apelá.',
            false, p_id, null, v_nombre);
          v_accion := 'oculta_y_suspendida';
        end if;
        -- Si después se acepta la apelación, también vuelven las denuncias que ocultó la IA esta semana.
        if v_accion = 'oculta_y_suspendida' then
          update public.suspensiones s
             set ocultadas = s.ocultadas || array(select d.id from public.denuncias d
                                                   where d.autor = v_autor and d.ia_abuso is not null and d.moderacion = 'falsa'
                                                     and d.creada > now() - interval '7 days' and not d.id = any(s.ocultadas))
           where s.usuario = v_autor;
        end if;
      end if;
    end if;
  end if;
  perform set_config('cde.ia', '0', true);
  perform set_config('cde.rpc', '0', true);
  return v_accion;
end $$;
revoke execute on function public.ia_guardar(text, text, text, text, text, text, text, text) from public;
grant execute on function public.ia_guardar(text, text, text, text, text, text, text, text) to anon, authenticated;

-- La revisión cada 5 minutos ahora también corre si hay denuncias recientes sin foto por revisar.
select cron.schedule('verificar-con-ia', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://mapa-cde-zspd.vercel.app/api/verificar',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-clave', (select valor from privado.ajustes where clave = 'ia_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.denuncias
                 where ia_revisada is null and not demo and coalesce(moderacion, '') <> 'falsa'
                   and (foto or creada > now() - interval '30 days'));
$cron$);

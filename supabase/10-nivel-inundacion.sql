-- Mapa Ciudadano CDE · 10: nivel de inundación que la IA ve en la foto
-- Ejecutar una vez en Supabase > SQL Editor, después de 08-antispam.sql.
--
-- En las denuncias de inundación con foto, la IA anota cuánta agua se ve: "leve" (charcos, agua en el cordón),
-- "moderada" (calle cubierta, agua a la altura de la rodilla o de las ruedas) o "alta" (agua que entra a las casas,
-- autos tapados, correntada). La vista de zonas inundables usa ese dato, junto con cuántas denuncias reales hay,
-- para pintar cada zona denunciada como inundación leve, moderada o alta.

alter table public.denuncias add column if not exists ia_nivel text check (ia_nivel in ('leve','moderada','alta'));

-- Igual que en 08-antispam.sql, sumando ia_nivel: solo la IA puede escribirlo.
create or replace function public.denuncias_proteger_ia() returns trigger
language plpgsql as $$
begin
  if not public.desde_la_app() or current_setting('cde.rpc', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.ia_estado := null; new.ia_motivo := null; new.ia_resumen := null; new.ia_revisada := null; new.ia_abuso := null;
    new.ia_nivel := null;
  else
    new.ia_estado := old.ia_estado; new.ia_motivo := old.ia_motivo; new.ia_resumen := old.ia_resumen; new.ia_revisada := old.ia_revisada;
    new.ia_abuso := old.ia_abuso; new.ia_nivel := old.ia_nivel;
  end if;
  return new;
end $$;

-- La llama la función de Vercel (api/verificar.js) después de ia_guardar, con la misma clave.
create or replace function public.ia_nivel_guardar(p_clave text, p_id text, p_nivel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ia_clave_valida(p_clave) then raise exception 'Clave inválida.' using errcode = '42501'; end if;
  if p_nivel is not null and p_nivel not in ('leve','moderada','alta') then raise exception 'Nivel inválido.'; end if;
  perform set_config('cde.rpc', '1', true);
  perform set_config('cde.ia', '1', true);
  update public.denuncias set ia_nivel = p_nivel where id = p_id and categoria = 'inundacion';
end $$;
revoke execute on function public.ia_nivel_guardar(text, text, text) from public;
grant execute on function public.ia_nivel_guardar(text, text, text) to anon, authenticated;

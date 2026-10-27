-- Mapa Ciudadano CDE · Permite deshacer "Yo también lo vi" y "Parece falsa".
-- Ejecutalo una sola vez en Supabase > SQL Editor (se puede repetir sin problema).

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

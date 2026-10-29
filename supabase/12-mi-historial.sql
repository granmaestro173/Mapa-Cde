-- Mapa Ciudadano CDE · 12: cada vecino puede ver sus propias denuncias rechazadas
-- Ejecutar una vez en Supabase > SQL Editor.
--
-- Las denuncias marcadas como falsas (por la moderación o por la IA) se ocultan para todos. Con este cambio,
-- quien la hizo la sigue viendo en "Mis denuncias > Historial", con el motivo del rechazo. En el mapa no aparece.

drop policy if exists "ver denuncias" on public.denuncias;
create policy "ver denuncias" on public.denuncias for select
  using (moderacion is distinct from 'falsa' or (select public.es_staff()) or autor = (select auth.uid()));

-- Mapa Ciudadano CDE · 11: mantener al día las denuncias de ejemplo
-- Ejecutar una vez en Supabase > SQL Editor.
--
-- Las denuncias de ejemplo se cargaron con fechas fijas y con los días van quedando viejas (en "Día" y "Semana"
-- ya no aparece ninguna). Esta función corre todas sus fechas para que la más reciente quede de hace 20 minutos,
-- manteniendo la distancia entre una y otra. Solo toca filas con demo = true. El historial no se toca, porque
-- sus huellas encadenadas dependen de la fecha de cada registro.
-- Se ejecuta ahora y después todos los días a las 4:00 (hora de Paraguay).

create or replace function public.ejemplos_al_dia() returns interval
language plpgsql security definer set search_path = public as $$
declare v_corrimiento interval;
begin
  select now() - interval '20 minutes' - max(creada) into v_corrimiento from public.denuncias where demo;
  if v_corrimiento is null or v_corrimiento < interval '1 minute' then return interval '0'; end if;
  update public.denuncias
     set creada = creada + v_corrimiento,
         resuelta_en = least(resuelta_en + v_corrimiento, now()),
         foto_tomada = least(foto_tomada + v_corrimiento, now())
   where demo;
  update public.obras set fecha = (fecha + v_corrimiento)::date where demo and fecha is not null;
  return v_corrimiento;
end $$;
revoke execute on function public.ejemplos_al_dia() from public, anon, authenticated;

select public.ejemplos_al_dia() as corrimiento;

select cron.unschedule('ejemplos-al-dia') where exists (select 1 from cron.job where jobname = 'ejemplos-al-dia');
select cron.schedule('ejemplos-al-dia', '0 7 * * *', 'select public.ejemplos_al_dia()');

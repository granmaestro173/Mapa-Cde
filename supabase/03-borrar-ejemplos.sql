-- =====================================================================
-- Mapa Ciudadano CDE · Borrar los datos de ejemplo
-- Usalo cuando el mapa pase a uso real. Borra las denuncias y obras de ejemplo
-- y sus registros del historial, vuelve a sellar la cadena de huellas y deja
-- constancia de la limpieza en el propio historial.
-- =====================================================================
begin;
delete from public.denuncias where demo;   -- arrastra sus obras y votos
delete from public.obras where demo;
delete from public.historial where demo;

do $$
declare r record; v_prev text := repeat('0', 64);
begin
  for r in select * from public.historial order by id loop
    update public.historial
       set previa = v_prev, huella = public.huella_de(v_prev, r.t, r.accion, r.detalle)
     where id = r.id;
    v_prev := public.huella_de(v_prev, r.t, r.accion, r.detalle);
  end loop;
end $$;

select public.registrar('Datos de ejemplo eliminados', 'Se quitaron las denuncias, obras e historial de demostración', false, now(), 'Administración');
commit;

select count(*) as denuncias_restantes from public.denuncias;

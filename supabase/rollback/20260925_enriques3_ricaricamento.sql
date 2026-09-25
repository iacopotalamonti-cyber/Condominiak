-- Rimette gli esercizi di via Enriques 3 com'erano prima della prova del
-- giro completo dall'interfaccia, dalla copia in supabase/dati/
-- 20260925_enriques3_copia_prima_del_ricaricamento.sql.
--
-- Per un solo anno, aggiungere "and anno = 2025" (o l'anno voluto) a ogni
-- delete e a ogni select. I fornitori creati dal ricaricamento restano in
-- anagrafica: non danno fastidio, e i movimenti ripristinati puntano a quelli
-- di prima, che non sono stati toccati.

do $$
begin
  if not exists (select 1 from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9') then
    raise exception 'Questo file è per il condominio di via Enriques 3 (f0b9dfd6-8b20-460a-8b2c-86176f06caa9): qui non esiste.';
  end if;
end $$;

delete from public.movimenti where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
delete from public.quote_unita where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
delete from public.incassi where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
delete from public.spese where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
delete from public.bilanci where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';

insert into public.bilanci select * from copie.enriques3_20260925_bilanci;
insert into public.spese select * from copie.enriques3_20260925_spese;
insert into public.incassi select * from copie.enriques3_20260925_incassi;
insert into public.quote_unita select * from copie.enriques3_20260925_quote_unita;
insert into public.movimenti select * from copie.enriques3_20260925_movimenti;

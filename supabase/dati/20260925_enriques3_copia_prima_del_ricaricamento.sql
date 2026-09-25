-- Copia delle righe di via Enriques 3 prima della prova del giro completo dei
-- consuntivi dall'interfaccia (cancella, ricarica, salva), il 25/09/2026.
--
-- Le copie stanno nello schema "copie", che l'API non espone: nessun utente le
-- vede, e restano finché qualcuno non le toglie. Per rimettere un esercizio
-- com'era prima, vedi supabase/rollback/20260925_enriques3_ricaricamento.sql.

do $$
begin
  if not exists (select 1 from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9') then
    raise exception 'Questo file è per il condominio di via Enriques 3 (f0b9dfd6-8b20-460a-8b2c-86176f06caa9): qui non esiste.';
  end if;
end $$;

create schema if not exists copie;
revoke all on schema copie from public, anon, authenticated;

create table copie.enriques3_20260925_bilanci as
  select * from public.bilanci where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
create table copie.enriques3_20260925_spese as
  select * from public.spese where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
create table copie.enriques3_20260925_incassi as
  select * from public.incassi where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
create table copie.enriques3_20260925_movimenti as
  select * from public.movimenti where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
create table copie.enriques3_20260925_quote_unita as
  select * from public.quote_unita where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
create table copie.enriques3_20260925_fornitori as
  select * from public.fornitori where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';
create table copie.enriques3_20260925_unita as
  select * from public.unita where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';

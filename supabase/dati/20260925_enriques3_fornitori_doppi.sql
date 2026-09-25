-- Due fornitori doppi nati dal ricaricamento del 2024-2025, il 25/09/2026.
--
-- Il PDF taglia i nomi lunghi alla larghezza della colonna: "Comune di
-- Bologna - Passi Carr", "S.G Service SNC di Sturba Leon". Il salvataggio non
-- li riconosceva come i fornitori già in anagrafica e ne creava di nuovi. Il
-- codice ora li riconosce per inizio (src/lib/fornitori.ts, trovaFornitore);
-- qui si rimettono a posto quelli già creati: i movimenti tornano sui
-- fornitori originali, che ricevono il nome tagliato come alias, e i doppioni
-- si cancellano.

do $$
begin
  if not exists (select 1 from public.condominiums where id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9') then
    raise exception 'Questo file è per il condominio di via Enriques 3 (f0b9dfd6-8b20-460a-8b2c-86176f06caa9): qui non esiste.';
  end if;
end $$;

-- Gli id dei fornitori restano testo: sono l'unico dato qui dentro che non è
-- il condominio, e confrontarli come testo lo tiene evidente.
with coppie(doppio, originale) as (values
  ('42a4027b-3824-4207-b1dd-951f4de123da', 'd1333bac-c3a5-421a-982b-20d62b90361d'),
  ('2210e3ea-7400-4915-90f1-976660037d25', '0dea2408-4b48-461a-bc9f-4d532f614514')
)
update public.movimenti m set fornitore_id = coppie.originale::uuid
from coppie
where m.fornitore_id::text = coppie.doppio and m.condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9';

update public.fornitori f set alias = array_append(f.alias, d.nome)
from public.fornitori d
where d.condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9'
  and f.condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9'
  and (d.id::text, f.id::text) in (
    ('42a4027b-3824-4207-b1dd-951f4de123da', 'd1333bac-c3a5-421a-982b-20d62b90361d'),
    ('2210e3ea-7400-4915-90f1-976660037d25', '0dea2408-4b48-461a-bc9f-4d532f614514')
  )
  and not d.nome = any(f.alias);

delete from public.fornitori
where condominium_id = 'f0b9dfd6-8b20-460a-8b2c-86176f06caa9'
  and id::text in ('42a4027b-3824-4207-b1dd-951f4de123da', '2210e3ea-7400-4915-90f1-976660037d25')
  and not exists (select 1 from public.movimenti m where m.fornitore_id = fornitori.id);

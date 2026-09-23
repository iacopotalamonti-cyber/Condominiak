-- Come tornare a prima di 20260923110000_quote_tre_esercizi.sql.
--
-- Non è una migrazione e non si applica da sola: sta qui perché ogni
-- cambiamento ai dati deve avere scritto, prima di essere fatto, il modo di
-- disfarlo (ROADMAP.md, regola 5).
--
-- Quella migrazione è quasi tutta additiva — 30 unità e 132 quote nuove — e
-- sulle 14 unità che c'erano scrive codice e subalterno, che erano vuoti. Il
-- solo valore che sovrascrive sono i millesimi, da due a tre decimali. Qui sotto
-- ci sono quelli di prima, fotografati dal database il 23/09/2026 prima di
-- applicarla.

delete from public.quote_unita where anno in (2023, 2024, 2025);

delete from public.unita
where condominium_id = (select id from public.condominiums limit 1)
  and tipologia <> 'appartamento';

update public.unita as u
set millesimi = prima.millesimi, codice = null, sub = null
from (values
  ('3df39d22-5c4c-41b7-b9ef-fbf8c63e8e01'::uuid, 79.070),
  ('5361e08d-ebfc-4fb2-ac8d-daedd9be9d58'::uuid, 44.610),
  ('60e49cf2-ee3e-4f18-85c9-3367fdf52311'::uuid, 62.550),
  ('265e99bf-7add-40ca-ad8d-c044400f2079'::uuid, 54.810),
  ('4f95b676-08a2-44c4-9672-75a477f79a2a'::uuid, 65.340),
  ('e5364b22-2dd0-4df1-9e19-a2bd69fb388d'::uuid, 57.860),
  ('86eb3c94-3685-4080-9636-d6ee50ac303d'::uuid, 81.190),
  ('aa382e60-42ed-464e-aec2-6962061466b4'::uuid, 47.030),
  ('d6f8b45e-625d-4a64-97b2-25c8992c6dd3'::uuid, 68.600),
  ('b10786fb-9403-472e-9c8b-5c3f52d8d90e'::uuid, 61.630),
  ('1c2514a5-a4a0-4d3a-b8a2-c6a1c89916a5'::uuid, 67.000),
  ('de21fe63-c6c6-4ad7-a928-d76a53121e46'::uuid, 61.230),
  ('935e99ff-5131-462c-93f1-dfc66d248d92'::uuid, 123.400),
  ('846e6b1b-c08e-476d-8b16-f035f5242921'::uuid, 34.210)
) as prima(id, millesimi)
where u.id = prima.id;

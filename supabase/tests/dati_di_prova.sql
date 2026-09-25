-- Dati finti per provare la RLS. SOLO STAGING.
--
-- Due condomini, A e B. Quattro utenti:
--   ...01  admin di A
--   ...02  condomino di A e di B, con tre unità (appartamento e box in A,
--          appartamento in B): è il caso che l'applicazione prima non reggeva
--   ...03  admin di B
--   ...04  iscritto, ma di nessun condominio
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_a@prova.local', '', now(), now(), '{}', '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'condomino@prova.local', '', now(), now(), '{}', '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_b@prova.local', '', now(), now(), '{}', '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'estraneo@prova.local', '', now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.condominiums (id, via, citta, owner_id) values
  ('cccccccc-0000-0000-0000-00000000000a', 'Via Prova A', 'Bologna', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-00000000000b', 'Via Prova B', 'Bologna', 'aaaaaaaa-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.membri (condominium_id, user_id, ruolo) values
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'resident'),
  ('cccccccc-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000002', 'resident'),
  ('cccccccc-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000003', 'admin')
on conflict (condominium_id, user_id) do nothing;

insert into public.unita (id, condominium_id, interno, codice, tipologia, millesimi) values
  ('dddddddd-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-00000000000a', 1, '001', 'appartamento', 500),
  ('dddddddd-0000-0000-0000-0000000000a2', 'cccccccc-0000-0000-0000-00000000000a', null, '002', 'box', 20),
  ('dddddddd-0000-0000-0000-0000000000a3', 'cccccccc-0000-0000-0000-00000000000a', 2, '003', 'appartamento', 480),
  ('dddddddd-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-00000000000b', 1, '001', 'appartamento', 1000)
on conflict (id) do nothing;

insert into public.unita_membri (unita_id, user_id) values
  ('dddddddd-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('dddddddd-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('dddddddd-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.bilanci (condominium_id, anno, consuntivo) values
  ('cccccccc-0000-0000-0000-00000000000a', 2025, 10000),
  ('cccccccc-0000-0000-0000-00000000000b', 2025, 20000)
on conflict (condominium_id, anno) do nothing;

insert into public.pagamenti (condominium_id, unita_id, anno, mese) values
  ('cccccccc-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-0000000000a1', 2025, 1),
  ('cccccccc-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-0000000000a3', 2025, 1)
on conflict do nothing;

insert into public.inviti (condominium_id, email, token_hash, scade_il) values
  ('cccccccc-0000-0000-0000-00000000000a', 'nuovo@prova.local', 'hash-di-prova', now() + interval '7 days')
on conflict (token_hash) do nothing;

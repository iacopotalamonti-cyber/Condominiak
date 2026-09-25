-- Chi apre quali file del bucket. SOLO STAGING, dopo dati_di_prova.sql.
--
-- Le righe di storage.objects qui sotto non hanno un file dietro: bastano per
-- provare le policy, che guardano solo il percorso. La prova finisce sempre
-- con un'eccezione, che annulla tutto: "ESITO: tutte le prove passate" è il
-- successo, qualunque altro messaggio è la prova che è fallita.

create function pg_temp.diventa(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.atteso(chi text, cosa text, visto bigint, voluto bigint) returns void language plpgsql as $$
begin
  if visto <> voluto then
    raise exception 'Storage: % vede % file di %, attesi %', chi, visto, cosa, voluto;
  end if;
end $$;

do $$
declare
  n bigint;
begin
  -- Storage vieta i DELETE diretti sulle sue tabelle; qui servono per provare
  -- chi può cancellare, e l'eccezione finale li annulla comunque.
  perform set_config('storage.allow_delete_query', 'true', true);
  insert into storage.objects (bucket_id, name) values
    ('documenti-condominiali', 'cccccccc-0000-0000-0000-00000000000a/documenti/0123456789abcdef-A.pdf'),
    ('documenti-condominiali', 'cccccccc-0000-0000-0000-00000000000a/1789403477588-Verbale A.pdf'),
    ('documenti-condominiali', 'cccccccc-0000-0000-0000-00000000000b/documenti/fedcba9876543210-B.pdf'),
    ('documenti-condominiali', 'pending/aaaaaaaa-0000-0000-0000-000000000001/11111111-2222-4333-8444-555555555555-mio.pdf'),
    ('documenti-condominiali', 'pending/aaaaaaaa-0000-0000-0000-000000000003/11111111-2222-4333-8444-555555555555-suo.pdf'),
    ('documenti-condominiali', 'documenti/aaaaaaaa-0000-0000-0000-000000000001/11111111-2222-4333-8444-555555555555-vecchio.pdf');

  -- admin di A: i file di A e il proprio caricamento, non quelli di B. Lo
  -- storico (documenti/{utente}) non passa dalle policy: lo apre il server.
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000001');
  select count(*) into n from storage.objects; perform pg_temp.atteso('admin A', 'bucket', n, 3);
  insert into storage.objects (bucket_id, name)
    values ('documenti-condominiali', 'cccccccc-0000-0000-0000-00000000000a/9999999999999-nuovo.pdf');
  begin
    insert into storage.objects (bucket_id, name)
      values ('documenti-condominiali', 'cccccccc-0000-0000-0000-00000000000b/9999999999999-intruso.pdf');
    raise exception 'Storage: admin A ha caricato nel condominio B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
      values ('documenti-condominiali', 'pending/aaaaaaaa-0000-0000-0000-000000000003/x-intruso.pdf');
    raise exception 'Storage: admin A ha caricato nella cartella di un altro';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where name like 'cccccccc-0000-0000-0000-00000000000b/%';
  get diagnostics n = row_count; perform pg_temp.atteso('admin A', 'file di B cancellabili', n, 0);

  -- condomino di A e di B: legge i documenti di entrambi, non scrive
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000002');
  select count(*) into n from storage.objects; perform pg_temp.atteso('condomino', 'bucket', n, 4);
  begin
    insert into storage.objects (bucket_id, name)
      values ('documenti-condominiali', 'cccccccc-0000-0000-0000-00000000000a/9999999999999-condomino.pdf');
    raise exception 'Storage: il condomino ha caricato un documento del condominio';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where name like 'cccccccc-%';
  get diagnostics n = row_count; perform pg_temp.atteso('condomino', 'file cancellabili', n, 0);

  -- estraneo: niente
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000004');
  select count(*) into n from storage.objects; perform pg_temp.atteso('estraneo', 'bucket', n, 0);

  -- l'admin cancella i file del proprio condominio
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000001');
  delete from storage.objects where name like 'cccccccc-0000-0000-0000-00000000000a/9999999999999-%';
  get diagnostics n = row_count; perform pg_temp.atteso('admin A', 'file propri cancellabili', n, 1);

  execute 'reset role';
  raise exception 'ESITO: tutte le prove passate (annullo per non lasciare righe)';
end $$;

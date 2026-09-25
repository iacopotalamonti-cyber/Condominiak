-- Chi vede cosa, e chi scrive dove. SOLO STAGING, dopo dati_di_prova.sql.
--
-- La prova si verifica da sola: se il cambio di utente non funzionasse, l'admin
-- di A vedrebbe tutti e due i condomini invece di uno, e fallirebbe.

create function pg_temp.diventa(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.atteso(chi text, cosa text, visto bigint, voluto bigint) returns void language plpgsql as $$
begin
  if visto <> voluto then
    raise exception 'RLS: % vede % righe di %, attese %', chi, visto, cosa, voluto;
  end if;
end $$;

do $$
declare
  n bigint;
begin
  -- admin di A
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000001');
  select count(*) into n from public.condominiums; perform pg_temp.atteso('admin A', 'condominiums', n, 1);
  select count(*) into n from public.unita;        perform pg_temp.atteso('admin A', 'unita', n, 3);
  select count(*) into n from public.bilanci;      perform pg_temp.atteso('admin A', 'bilanci', n, 1);
  select count(*) into n from public.pagamenti;    perform pg_temp.atteso('admin A', 'pagamenti', n, 2);
  select count(*) into n from public.membri;       perform pg_temp.atteso('admin A', 'membri', n, 2);
  select count(*) into n from public.inviti;       perform pg_temp.atteso('admin A', 'inviti', n, 1);
  begin
    insert into public.bilanci (condominium_id, anno) values ('cccccccc-0000-0000-0000-00000000000a', 2024);
    raise exception 'annulla' using errcode = 'P0001';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    insert into public.bilanci (condominium_id, anno) values ('cccccccc-0000-0000-0000-00000000000b', 2024);
    raise exception 'RLS: admin A ha scritto nel condominio B';
  exception when insufficient_privilege then null;
  end;
  update public.unita set millesimi = millesimi where condominium_id = 'cccccccc-0000-0000-0000-00000000000b';
  get diagnostics n = row_count; perform pg_temp.atteso('admin A', 'unita di B modificabili', n, 0);

  -- condomino di A e di B, con tre unità
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000002');
  select count(*) into n from public.condominiums; perform pg_temp.atteso('condomino', 'condominiums', n, 2);
  select count(*) into n from public.unita;        perform pg_temp.atteso('condomino', 'unita', n, 4);
  select count(*) into n from public.bilanci;      perform pg_temp.atteso('condomino', 'bilanci', n, 2);
  select count(*) into n from public.pagamenti;    perform pg_temp.atteso('condomino', 'pagamenti (solo le sue unità)', n, 1);
  select count(*) into n from public.membri;       perform pg_temp.atteso('condomino', 'membri (solo i suoi)', n, 2);
  select count(*) into n from public.unita_membri; perform pg_temp.atteso('condomino', 'unita_membri', n, 3);
  select count(*) into n from public.inviti;       perform pg_temp.atteso('condomino', 'inviti', n, 0);
  update public.unita set millesimi = 999 where id = 'dddddddd-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count; perform pg_temp.atteso('condomino', 'unità propria modificabile', n, 0);
  delete from public.bilanci;
  get diagnostics n = row_count; perform pg_temp.atteso('condomino', 'bilanci cancellabili', n, 0);
  begin
    insert into public.bilanci (condominium_id, anno) values ('cccccccc-0000-0000-0000-00000000000a', 2023);
    raise exception 'RLS: il condomino ha scritto un bilancio';
  exception when insufficient_privilege then null;
  end;
  update public.membri set ruolo = 'admin' where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  get diagnostics n = row_count; perform pg_temp.atteso('condomino', 'autopromozione', n, 0);
  begin
    insert into public.membri (condominium_id, user_id, ruolo)
      values ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'admin');
    raise exception 'RLS: il condomino si è aggiunto come admin';
  exception when insufficient_privilege or unique_violation then null;
  end;
  begin
    insert into public.unita_membri (unita_id, user_id)
      values ('dddddddd-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000002');
    raise exception 'RLS: il condomino si è preso un appartamento altrui';
  exception when insufficient_privilege then null;
  end;

  -- admin di B
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000003');
  select count(*) into n from public.condominiums; perform pg_temp.atteso('admin B', 'condominiums', n, 1);
  select count(*) into n from public.unita;        perform pg_temp.atteso('admin B', 'unita', n, 1);
  select count(*) into n from public.pagamenti;    perform pg_temp.atteso('admin B', 'pagamenti', n, 0);
  select count(*) into n from public.membri;       perform pg_temp.atteso('admin B', 'membri', n, 2);
  select count(*) into n from public.inviti;       perform pg_temp.atteso('admin B', 'inviti di A', n, 0);

  -- iscritto, di nessun condominio
  perform pg_temp.diventa('aaaaaaaa-0000-0000-0000-000000000004');
  select count(*) into n from public.condominiums; perform pg_temp.atteso('estraneo', 'condominiums', n, 0);
  select count(*) into n from public.unita;        perform pg_temp.atteso('estraneo', 'unita', n, 0);
  select count(*) into n from public.quote_unita;  perform pg_temp.atteso('estraneo', 'quote', n, 0);
  select count(*) into n from public.membri;       perform pg_temp.atteso('estraneo', 'membri', n, 0);

  -- senza accesso: la domanda si ferma prima della RLS
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    perform 1 from public.condominiums;
    raise exception 'RLS: anon ha potuto interrogare condominiums';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
end $$;

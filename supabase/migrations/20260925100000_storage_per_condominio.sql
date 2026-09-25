-- I file del bucket appartengono al condominio, e li decide la tabella membri.
--
-- Le policy di Storage erano rimaste al modello di prima: scriveva solo chi
-- risultava owner_id del condominio, leggeva chi aveva un'unità con il proprio
-- user_id. Un condomino arrivato con un invito sta in unita_membri, non in
-- unita.user_id, e non avrebbe aperto nessun documento; un secondo
-- amministratore non avrebbe potuto caricarne.
--
-- Le cartelle:
--   pending/{utente}/...      caricato e non ancora salvato: solo di chi l'ha caricato
--   {condominio}/...          del condominio: lo leggono i membri, lo scrivono gli admin
--
-- Il confronto è fra testi: la prima cartella non è sempre un uuid ("pending",
-- "documenti"), e un cast fallito farebbe fallire la query intera.
--
-- Una policy per azione, perché due policy permissive sulla stessa azione si
-- valutano entrambe su ogni riga.

drop policy if exists admin_storage_documenti on storage.objects;
drop policy if exists resident_read_storage_documenti on storage.objects;
drop policy if exists own_pending_uploads on storage.objects;

create policy documenti_leggere on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documenti-condominiali'
    and (
      ((storage.foldername(name))[1] = 'pending'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or (storage.foldername(name))[1] in (select c::text from public.condomini_membro() as c)
    )
  );

create policy documenti_caricare on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documenti-condominiali'
    and (
      ((storage.foldername(name))[1] = 'pending'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or (storage.foldername(name))[1] in (select c::text from public.condomini_admin() as c)
    )
  );

create policy documenti_modificare on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documenti-condominiali'
    and (
      ((storage.foldername(name))[1] = 'pending'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or (storage.foldername(name))[1] in (select c::text from public.condomini_admin() as c)
    )
  )
  with check (
    bucket_id = 'documenti-condominiali'
    and (
      ((storage.foldername(name))[1] = 'pending'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or (storage.foldername(name))[1] in (select c::text from public.condomini_admin() as c)
    )
  );

create policy documenti_cancellare on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documenti-condominiali'
    and (
      ((storage.foldername(name))[1] = 'pending'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or (storage.foldername(name))[1] in (select c::text from public.condomini_admin() as c)
    )
  );

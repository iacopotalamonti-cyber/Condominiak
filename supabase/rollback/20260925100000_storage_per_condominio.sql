-- Rimette le policy di Storage com'erano prima di 20260925100000.

drop policy if exists documenti_leggere on storage.objects;
drop policy if exists documenti_caricare on storage.objects;
drop policy if exists documenti_modificare on storage.objects;
drop policy if exists documenti_cancellare on storage.objects;

create policy admin_storage_documenti on storage.objects
  for all
  using (
    bucket_id = 'documenti-condominiali'
    and ((storage.foldername(name))[1])::uuid in (
      select condominiums.id from public.condominiums where condominiums.owner_id = auth.uid()
    )
  );

create policy resident_read_storage_documenti on storage.objects
  for select
  using (
    bucket_id = 'documenti-condominiali'
    and ((storage.foldername(name))[1])::uuid in (
      select unita.condominium_id from public.unita where unita.user_id = auth.uid()
    )
  );

create policy own_pending_uploads on storage.objects
  for all
  using (
    bucket_id = 'documenti-condominiali'
    and (storage.foldername(name))[1] = 'pending'
    and (storage.foldername(name))[2] = (auth.uid())::text
  )
  with check (
    bucket_id = 'documenti-condominiali'
    and (storage.foldername(name))[1] = 'pending'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );

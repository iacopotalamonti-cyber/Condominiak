-- Quanto spazio occupano i documenti.
--
-- I PDF sono il vero volume del prodotto: un rendiconto pesa da 0,6 a 2,3 MB,
-- le righe di un condominio in dieci anni qualche centinaio di kB. Il piano
-- gratuito di Supabase ha 1 GB di Storage; va saputo prima di arrivarci, non
-- quando un caricamento fallisce.
--
-- spazio_documenti: file e byte di un condominio, per chi lo amministra.
-- spazio_bucket: il totale del bucket, per la manutenzione (solo service_role).
--
-- Si legge da storage.objects, che le policy di Storage filtrano per utente:
-- da qui la security definer, con il controllo sul condominio dentro la query.

create or replace function public.spazio_documenti(condominio uuid)
returns table (file bigint, byte bigint)
language sql stable security definer set search_path = ''
as $$
  select count(*), coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = 'documenti-condominiali'
    and (storage.foldername(o.name))[1] = condominio::text
    and condominio in (select public.condomini_admin())
$$;

create or replace function public.spazio_bucket()
returns table (file bigint, byte bigint)
language sql stable security definer set search_path = ''
as $$
  select count(*), coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = 'documenti-condominiali'
$$;

revoke all on function public.spazio_documenti(uuid) from public, anon;
grant execute on function public.spazio_documenti(uuid) to authenticated, service_role;

revoke all on function public.spazio_bucket() from public, anon, authenticated;
grant execute on function public.spazio_bucket() to service_role;

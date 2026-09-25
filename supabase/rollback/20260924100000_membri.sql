-- Come tornare a prima di 20260924100000_membri.sql.
--
-- Ripristina le policy basate su condominiums.owner_id e unita.user_id. Non
-- cancella membri, unita_membri e inviti: chi è entrato con un invito nel
-- frattempo resta registrato, e rimettendo la migrazione torna a vedere.
-- Il codice rilasciato insieme a quella migrazione legge membri: tornare
-- indietro qui vuol dire tornare indietro anche con il codice.

do $$
declare
  t text;
begin
  foreach t in array array['unita', 'bilanci', 'spese', 'incassi', 'quote_unita', 'fornitori', 'movimenti', 'impianti', 'documenti', 'pagamenti']
  loop
    execute format('drop policy if exists %1$s_lettura on public.%1$I', t);
    execute format('drop policy if exists %1$s_inserimento on public.%1$I', t);
    execute format('drop policy if exists %1$s_modifica on public.%1$I', t);
    execute format('drop policy if exists %1$s_cancellazione on public.%1$I', t);
  end loop;
end $$;

drop policy if exists condominio_lettura on public.condominiums;
drop policy if exists condominio_modifica on public.condominiums;

create policy owner_full_access on public.condominiums
  for all using (owner_id = auth.uid());

create policy admin_access on public.unita
  for all using (condominium_id in (select id from public.condominiums where owner_id = auth.uid()));
create policy resident_access on public.unita
  for all using (user_id = auth.uid());

create policy admin_pagamenti on public.pagamenti
  for all using (condominium_id in (select id from public.condominiums where owner_id = auth.uid()));
create policy resident_read_pagamenti on public.pagamenti
  for select using (unita_id in (select id from public.unita where user_id = auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['bilanci', 'spese', 'incassi', 'quote_unita', 'fornitori', 'movimenti', 'impianti', 'documenti']
  loop
    execute format($f$
      create policy admin_%1$s on public.%1$I
        for all using (condominium_id in (select id from public.condominiums where owner_id = auth.uid()))
    $f$, t);
    execute format($f$
      create policy resident_read_%1$s on public.%1$I
        for select using (condominium_id in (select condominium_id from public.unita where user_id = auth.uid()))
    $f$, t);
  end loop;
end $$;

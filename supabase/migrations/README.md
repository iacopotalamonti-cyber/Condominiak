# Migrazioni

`00000000000000_schema_iniziale.sql` contiene lo schema completo — tabelle,
indici, policy RLS, bucket storage — ricostruito dal database di produzione il
19/09/2026. Su un database nuovo si esegue per primo; le quattro migrazioni
datate che lo seguono non trovano più nulla da fare, e va bene così.

Le migrazioni vanno applicate in ordine di nome, una sola volta, sul progetto
Supabase del condominio. Due modi equivalenti:

- dalla dashboard Supabase: **SQL Editor**, incolla il contenuto del file, Run;
- da riga di comando, con la Supabase CLI collegata al progetto:
  `supabase db push`.

Sono scritte per essere rieseguibili senza danno (`add column if not exists`):
lanciarle due volte non rompe nulla.

Una migrazione è schema: tabelle, colonne, indici, policy, permessi. Può
trasformare i dati che ci sono in modo generale (per tutti i condomini, a
partire dalle loro colonne), ma non contiene mai i dati di un condominio: quelli
vanno in `supabase/dati/`, dove ogni file è ancorato al proprio condominio.
Un test in CI lo verifica.


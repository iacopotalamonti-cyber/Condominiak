# Dati di un condominio

Qui stanno le scritture che riguardano **un** condominio: numeri letti dai suoi
documenti, correzioni della sua anagrafica. Non sono migrazioni, e non girano
da sole su nessun database.

Ogni file:

- nel nome dice la data e il condominio (`20260923_enriques3_...`);
- comincia con un controllo che il condominio esista, per id, e altrimenti si
  ferma prima di scrivere;
- nomina quel condominio per id in ogni istruzione — mai
  `(select id from public.condominiums limit 1)`, che su un database con due
  condomini ne sceglie uno a caso, e mai un `update` o un `delete` senza
  `condominium_id`.

`src/lib/__tests__/migrazioni.test.ts` controlla queste regole a ogni CI.

I tre file che ci sono erano migrazioni, già applicate in produzione nel giorno
del loro nome: restano come registro di cosa è stato scritto e perché. Il
modo di tornare indietro dall'ultimo è in
`supabase/rollback/20260923110000_quote_tre_esercizi.sql`.

Si applicano dal SQL Editor della dashboard Supabase, sul progetto giusto, dopo
un backup.

# Prove della RLS

Si eseguono **solo su staging**, mai in produzione: creano utenti e condomini
finti.

1. `dati_di_prova.sql` — quattro utenti e due condomini, con una persona che
   appartiene a entrambi e ha tre unità. Si applica una volta; è idempotente.
2. `rls_membri.sql` — per ogni utente simulato conta cosa vede e prova a
   scrivere dove non dovrebbe. Ogni scrittura riuscita viene annullata, e ogni
   risultato inatteso fa fallire tutto: se passa, non lascia niente.

Vanno rilanciate ogni volta che si tocca una policy. Una policy nuova senza una
riga qui è una policy che nessuno ha provato.

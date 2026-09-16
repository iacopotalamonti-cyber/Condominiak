-- Terzo stato della verifica di un importo.
--
-- fonte_verificata da sola confondeva due casi molto diversi: "ho letto la
-- pagina del PDF e l'importo non c'è" (un errore da controllare) e "il
-- documento è una scansione senza testo, non ho potuto controllare" (nessuna
-- informazione). Con una sola colonna entrambi apparivano come non verificati.

alter table public.spese
  add column if not exists fonte_verificabile boolean not null default false;

comment on column public.spese.fonte_verificabile is
  'true se la pagina del PDF era leggibile e il controllo è stato eseguito; con fonte_verificata false significa che l''importo in quella pagina non c''è.';

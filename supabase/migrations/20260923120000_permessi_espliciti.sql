-- I permessi sulle tabelle diventano espliciti, e restano solo a chi serve.
--
-- Dal 30 ottobre 2026 Supabase smette di concedere in automatico l'accesso
-- all'API alle tabelle nuove dello schema public. Le tabelle che esistono già
-- tengono i permessi che hanno, quindi la produzione non si ferma. Si ferma
-- invece la sua ricostruzione: le migrazioni di questo repository creano le
-- tabelle e non concedono niente, perché fino a oggi lo faceva Supabase. Un
-- ripristino su un progetto nuovo, lo staging rifatto, un "supabase db reset"
-- darebbero un database con tutte le tabelle e un'applicazione che non ne legge
-- nessuna. Il ripristino è la ragione per cui il backup esiste.
--
-- Quello che Supabase concedeva era tutto a tutti: lettura, scrittura e
-- cancellazione anche ad anon, cioè a chiunque abbia la chiave pubblica — che
-- sta nel codice del sito. Fra quella chiave e i dati c'era soltanto la RLS.
-- Regge, ed è stata verificata: senza utente ogni policy restituisce zero righe.
-- Ma una sola policy scritta male avrebbe esposto i dati di un condominio a
-- internet. L'applicazione non legge né scrive mai una tabella senza un utente
-- autenticato (le due letture della pagina d'invito avvengono dopo l'accesso),
-- quindi anon non ha bisogno di niente, e niente gli resta.
--
-- Si concede tabella per tabella e non con "alter default privileges", che
-- restituirebbe i permessi automatici a ogni tabella futura: è proprio ciò che
-- Supabase toglie, perché una tabella nuova senza RLS sarebbe leggibile da
-- qualunque utente. Ogni migrazione che crea una tabella concede i suoi.

-- Chi non ha fatto l'accesso non tocca nessuna tabella.
revoke all on table
  public.condominiums, public.unita, public.bilanci, public.spese, public.incassi,
  public.quote_unita, public.movimenti, public.fornitori, public.impianti,
  public.pagamenti, public.documenti
from anon;

-- L'applicazione, per conto dell'utente: solo le quattro operazioni che l'API
-- sa fare, e la RLS decide su quali righe. Niente TRUNCATE, che la RLS non
-- filtra.
revoke all on table
  public.condominiums, public.unita, public.bilanci, public.spese, public.incassi,
  public.quote_unita, public.movimenti, public.fornitori, public.impianti,
  public.pagamenti, public.documenti
from authenticated;

grant select, insert, update, delete on table
  public.condominiums, public.unita, public.bilanci, public.spese, public.incassi,
  public.quote_unita, public.movimenti, public.fornitori, public.impianti,
  public.pagamenti, public.documenti
to authenticated;

-- Le route del server e la funzione di estrazione, che verificano da sé chi
-- sta chiedendo prima di usare questa chiave.
grant all on table
  public.condominiums, public.unita, public.bilanci, public.spese, public.incassi,
  public.quote_unita, public.movimenti, public.fornitori, public.impianti,
  public.pagamenti, public.documenti
to service_role;

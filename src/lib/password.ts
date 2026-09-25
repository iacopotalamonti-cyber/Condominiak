// La lunghezza minima di una password. Deve coincidere con quella impostata in
// Supabase → Authentication → Sign In / Providers → Email → Minimum password
// length: se il sito accetta meno di Supabase, l'utente riceve un errore in
// inglese invece dell'avviso del modulo.
//
// Otto e non sei: la protezione contro le password già finite in un furto di
// dati (HaveIBeenPwned) richiede il piano Pro di Supabase, e sul piano
// gratuito la lunghezza è la difesa che resta.
export const PASSWORD_MINIMA = 8;

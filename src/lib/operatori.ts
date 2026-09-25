// Chi gestisce Condominiak, non un condominio.
//
// Alcune decisioni valgono per tutti i condomini: una scheda di formato
// approvata legge i rendiconti di ogni condominio amministrato da quello
// studio. Non può prenderle l'amministratore di un condominio. Gli operatori
// sono elencati per email nella variabile d'ambiente OPERATORI, separati da
// virgole; senza la variabile non c'è nessun operatore, e nessuna scheda si
// approva.

export function eOperatore(email: string | null | undefined): boolean {
  if (!email) return false;
  const elenco = (process.env.OPERATORI ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return elenco.includes(email.trim().toLowerCase());
}

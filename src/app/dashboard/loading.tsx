// Ogni pagina della dashboard interroga il database dal server, quindi fra il
// clic e il contenuto passa qualche decimo di secondo in cui prima non
// succedeva niente e l'app sembrava bloccata. Questo scheletro compare subito.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">Caricamento in corso…</span>
    </div>
  );
}
